import { randomUUID } from "crypto";
import { readFile } from "fs/promises";
import path from "path";
import { ensureUser, holdCredits, captureHold, releaseHold } from "./credits";
import { AppError } from "./errors";
import { assertImage, mimeFromExt, removeJobImages, saveJobImages, type StoredImage } from "./images";
import { renderPlanForTemplate } from "./models";
import { getProvider } from "./providers";
import type { ProviderStatus } from "./providers/types";
import { mutate } from "./store";
import type { JobPublic, JobRecord, Template } from "./types";

export function toPublic(job: JobRecord): JobPublic {
  return {
    id: job.id,
    templateId: job.templateId,
    templateSlug: job.templateSlug,
    templateName: job.templateName,
    status: job.status,
    creditCost: job.creditCost,
    creditsState: job.creditsState,
    provider: job.provider,
    imageCount: job.imageCount,
    resultUrl: job.resultUrl,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

export function applyProviderUpdate(dbJobsUser: {
  db: import("./types").Database;
  job: JobRecord;
  update: ProviderStatus;
  now: string;
}): void {
  const { db, job, update, now } = dbJobsUser;
  if (job.status === "done" || job.status === "failed") return;
  if (update.status === "pending" || update.status === "running") {
    job.status = update.status;
    job.updatedAt = now;
    return;
  }
  if (update.status === "done") {
    job.status = "done";
    job.resultUrl = update.resultUrl || `/api/jobs/${job.id}/result`;
    job.error = null;
    job.updatedAt = now;
    captureHold(db, job, now);
    return;
  }
  job.status = "failed";
  job.error = update.error || "Render failed";
  job.updatedAt = now;
  releaseHold(db, job, now, "Returned after a failed render");
}

export async function createGenerationJob(input: {
  userId: string;
  template: Template;
  files: StoredImage[];
}): Promise<JobPublic> {
  const { template, files, userId } = input;
  if (files.length !== template.photo_count) {
    throw new AppError(
      "bad_photo_count",
      `Upload ${template.photo_count} photo${template.photo_count === 1 ? "" : "s"} for ${template.name}.`,
      400,
    );
  }
  for (const file of files) assertImage(file);

  const id = randomUUID();
  const now = new Date().toISOString();
  const provider = getProvider();
  const cost = renderPlanForTemplate(template.slug, template.credit_cost).unitCost;

  await mutate((db) => {
    ensureUser(db, userId, now);
    const job: JobRecord = {
      id,
      userId,
      templateId: template.id,
      templateSlug: template.slug,
      templateName: template.name,
      status: "pending",
      creditCost: cost,
      creditsState: "held",
      provider: provider.name,
      providerJobId: null,
      imageCount: files.length,
      imagePaths: [],
      resultUrl: null,
      error: null,
      createdAt: now,
      updatedAt: now,
    };
    holdCredits(db, userId, cost, id, `Hold for ${template.name}`, now);
    db.jobs[id] = job;
  });

  try {
    const imagePaths = await saveJobImages(id, files);
    const generated = await provider.generate({
      templateKey: template.slug,
      imageUrls: imagePaths.map((_, index) => `/api/jobs/${id}/images/${index}`),
      jobId: id,
    });
    return await mutate((db) => {
      const job = db.jobs[id];
      job.imagePaths = imagePaths;
      job.providerJobId = generated.providerJobId;
      job.updatedAt = new Date().toISOString();
      return toPublic(job);
    });
  } catch (error) {
    await mutate((db) => {
      const job = db.jobs[id];
      if (!job) return;
      job.status = "failed";
      job.error = error instanceof Error ? error.message : "Could not store the upload.";
      job.updatedAt = new Date().toISOString();
      releaseHold(db, job, job.updatedAt, "Returned because the upload could not be stored");
    });
    await removeJobImages(id);
    throw error;
  }
}

export async function readJob(userId: string, jobId: string): Promise<JobPublic | null> {
  const snapshot = await mutate((db) => {
    const job = db.jobs[jobId];
    if (!job || job.userId !== userId) return null;
    return {
      provider: job.provider,
      providerJobId: job.providerJobId,
      createdAt: job.createdAt,
      status: job.status,
    };
  });
  if (!snapshot) return null;
  if (snapshot.status === "done" || snapshot.status === "failed" || !snapshot.providerJobId) {
    return mutate((db) => {
      const job = db.jobs[jobId];
      return job && job.userId === userId ? toPublic(job) : null;
    });
  }

  const provider = getProvider();
  const update =
    snapshot.provider === provider.name
      ? await provider.getStatus(snapshot.providerJobId, snapshot.createdAt)
      : { status: snapshot.status };

  return mutate((db) => {
    const job = db.jobs[jobId];
    if (!job || job.userId !== userId) return null;
    applyProviderUpdate({ db, job, update, now: new Date().toISOString() });
    return toPublic(job);
  });
}

export async function listJobs(userId: string): Promise<JobPublic[]> {
  return mutate((db) =>
    Object.values(db.jobs)
      .filter((job) => job.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(toPublic),
  );
}

export async function applyCallback(input: {
  jobId: string;
  providerJobId: string;
  status: "done" | "failed" | "running";
  error?: string;
}): Promise<JobPublic> {
  return mutate((db) => {
    const job = db.jobs[input.jobId];
    if (!job || !job.providerJobId || job.providerJobId !== input.providerJobId) {
      throw new AppError("not_found", "No matching provider job.", 404);
    }
    const update: ProviderStatus =
      input.status === "done"
        ? { status: "done", resultUrl: `/api/jobs/${job.id}/result` }
        : input.status === "failed"
          ? { status: "failed", error: input.error || "Provider reported a failure." }
          : { status: "running" };
    applyProviderUpdate({ db, job, update, now: new Date().toISOString() });
    return toPublic(job);
  });
}

export async function readJobImage(
  userId: string,
  jobId: string,
  index: number,
): Promise<{ bytes: Buffer; mime: NonNullable<ReturnType<typeof mimeFromExt>> } | null> {
  const relative = await mutate((db) => {
    const job = db.jobs[jobId];
    if (!job || job.userId !== userId) return null;
    return job.imagePaths[index] ?? null;
  });
  if (!relative) return null;
  const root = path.join(process.cwd(), "data", "uploads", jobId);
  const absolute = path.resolve(process.cwd(), relative);
  if (!absolute.startsWith(root + path.sep)) return null;
  const ext = path.extname(absolute).slice(1);
  const mime = mimeFromExt(ext);
  if (!mime) return null;
  const bytes = await readFile(absolute);
  return { bytes, mime };
}

export async function requireOwnedJob(userId: string, jobId: string): Promise<JobRecord | null> {
  return mutate((db) => {
    const job = db.jobs[jobId];
    if (!job || job.userId !== userId) return null;
    return job;
  });
}
