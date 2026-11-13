import { mkdir, readdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { findTemplate } from "../catalog";
import type { GenerateInput, ProviderStatus, VideoProvider } from "./types";

const DEFAULT_BASE_URL = "https://aigc-new.sailf.work";
// doubao-seedance-2.0-mini, the cheapest public video model on the gateway.
const DEFAULT_MODEL = "model-4e2cf014f835822786c5d25d207257e3-zyf";
const DEFAULT_RESOLUTION = "720p";
const DEFAULT_ASPECT_RATIO = "9:16";
const DEFAULT_DURATION = "5";
const REQUEST_TIMEOUT_MS = 120_000;
const DOWNLOAD_TIMEOUT_MS = 300_000;
const RENDER_TIMEOUT_MS = 20 * 60_000;
// The job page polls once per second; only ask upstream every few seconds.
const POLL_INTERVAL_MS = 8_000;

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const QUEUED_STATUSES = new Set(["queued", "pending", "not_start", "submitted"]);
const COMPLETED_STATUSES = new Set(["completed", "success"]);
const FAILED_STATUSES = new Set(["failed", "failure"]);

type SailfConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
  resolution: string;
  aspectRatio: string;
  duration: string;
};

type SailfTask = {
  id?: string;
  task_id?: string;
  status?: string;
  phase?: string;
  progress?: number;
  terminal?: boolean;
  is_final?: boolean;
  cdn_pending?: boolean;
  stage?: string;
  message?: string;
  error?: { code?: string; message?: string } | string;
};

function config(): SailfConfig {
  const apiKey = process.env.SAILF_API_KEY;
  if (!apiKey) {
    throw new Error("SAILF_API_KEY is not set. Add it to .env.local to use the sailf provider.");
  }
  return {
    baseUrl: (process.env.SAILF_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, ""),
    apiKey,
    model: process.env.SAILF_MODEL || DEFAULT_MODEL,
    resolution: process.env.SAILF_RESOLUTION || DEFAULT_RESOLUTION,
    aspectRatio: process.env.SAILF_ASPECT_RATIO || DEFAULT_ASPECT_RATIO,
    duration: process.env.SAILF_DURATION || DEFAULT_DURATION,
  };
}

function resultsDir(): string {
  return path.join(process.cwd(), "data", "results");
}

function resultPath(jobId: string): string {
  return path.join(resultsDir(), `${jobId}.mp4`);
}

/** Provider ids look like `sailf_<task_id>_<job_id>`; task ids contain underscores too. */
function parseProviderJobId(providerJobId: string): { taskId: string; jobId: string } {
  const rest = providerJobId.replace(/^sailf_/, "");
  const split = rest.lastIndexOf("_");
  return { taskId: rest.slice(0, split), jobId: rest.slice(split + 1) };
}

async function failureDetail(response: Response): Promise<string> {
  const text = await response.text().catch(() => "");
  try {
    const payload = JSON.parse(text) as {
      error?: { code?: string; message?: string };
      message?: string;
    };
    const detail = [payload.error?.code, payload.error?.message || payload.message]
      .filter(Boolean)
      .join(": ");
    if (detail) return detail;
  } catch {
    // Not JSON; fall back to the raw body.
  }
  return text.slice(0, 300) || response.statusText;
}

async function readUploads(jobId: string): Promise<{ name: string; bytes: Buffer; mime: string }[]> {
  const dir = path.join(process.cwd(), "data", "uploads", jobId);
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    throw new Error(`No uploaded photos found for job ${jobId}.`);
  }
  names.sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10));
  const files: { name: string; bytes: Buffer; mime: string }[] = [];
  for (const name of names) {
    const mime = MIME_BY_EXT[path.extname(name).slice(1).toLowerCase()];
    if (!mime) continue;
    files.push({ name, bytes: await readFile(path.join(dir, name)), mime });
  }
  return files;
}

/** Reference photos must be uploaded first; the API refuses external URLs and base64. */
async function uploadAsset(cfg: SailfConfig, file: { name: string; bytes: Buffer; mime: string }): Promise<string> {
  const query = new URLSearchParams({ model: cfg.model, mode: "reference", kind: "images" });
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(file.bytes)], { type: file.mime }), file.name);
  const response = await fetch(`${cfg.baseUrl}/studio-api/assets?${query}`, {
    method: "POST",
    headers: { authorization: `Bearer ${cfg.apiKey}` },
    body: form,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Sailf asset upload ${response.status}: ${await failureDetail(response)}`);
  }
  const payload = (await response.json()) as { asset_id?: string };
  if (!payload.asset_id) {
    throw new Error("Sailf accepted the photo but returned no asset id.");
  }
  return payload.asset_id;
}

function buildPrompt(input: GenerateInput): string {
  const template = findTemplate(input.templateKey);
  const subject = template?.name ?? input.templateKey;
  return [
    `Animate the reference photo(s) into the "${subject}" effect as one short vertical clip.`,
    "Keep the subject's face, outfit and colours consistent with the reference.",
    "Add subtle camera movement, natural lighting and a smooth, seamless motion.",
  ].join(" ");
}

async function submitTask(cfg: SailfConfig, prompt: string, assetIds: string[]): Promise<string> {
  const body: Record<string, unknown> = {
    model: cfg.model,
    prompt,
    count: 1,
    mode: assetIds.length > 0 ? "reference" : "text-to-video",
    duration: cfg.duration,
    resolution: cfg.resolution,
    aspect_ratio: cfg.aspectRatio,
  };
  if (assetIds.length > 0) body.images = assetIds;

  const response = await fetch(`${cfg.baseUrl}/v1/videos`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${cfg.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Sailf video submit ${response.status}: ${await failureDetail(response)}`);
  }
  const payload = (await response.json()) as SailfTask;
  const taskId = payload.id || payload.task_id;
  if (!taskId) {
    throw new Error("Sailf accepted the request but returned no task id.");
  }
  return taskId;
}

async function downloadResult(cfg: SailfConfig, taskId: string, jobId: string): Promise<void> {
  const response = await fetch(`${cfg.baseUrl}/v1/videos/${taskId}/content`, {
    headers: { authorization: `Bearer ${cfg.apiKey}` },
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Sailf video download ${response.status}: ${await failureDetail(response)}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 1024) {
    throw new Error("Sailf returned an empty video file.");
  }
  await mkdir(resultsDir(), { recursive: true });
  await writeFile(resultPath(jobId), bytes);
}

function taskFailure(task: SailfTask): string {
  const error = task.error;
  if (typeof error === "string" && error) return error;
  if (error && typeof error === "object") {
    const detail = [error.code, error.message].filter(Boolean).join(": ");
    if (detail) return detail;
  }
  return task.message || "Sailf reported a failed render.";
}

const lastPoll = new Map<string, { at: number; status: ProviderStatus }>();

export const sailfProvider: VideoProvider = {
  name: "sailf",
  async generate(input) {
    const cfg = config();
    const uploads = await readUploads(input.jobId);
    if (uploads.length === 0) {
      throw new Error(`No usable photo found for job ${input.jobId}.`);
    }
    const assetIds: string[] = [];
    for (const file of uploads) {
      assetIds.push(await uploadAsset(cfg, file));
    }
    const taskId = await submitTask(cfg, buildPrompt(input), assetIds);
    return { providerJobId: `sailf_${taskId}_${input.jobId}` };
  },
  async getStatus(providerJobId, startedAt): Promise<ProviderStatus> {
    const { taskId, jobId } = parseProviderJobId(providerJobId);
    try {
      await readFile(resultPath(jobId));
      return { status: "done", resultUrl: `/api/jobs/${jobId}/result`, resultMime: "video/mp4" };
    } catch {
      // Not downloaded yet.
    }

    const elapsed = Date.now() - Date.parse(startedAt);
    if (Number.isFinite(elapsed) && elapsed > RENDER_TIMEOUT_MS) {
      return { status: "failed", error: "Sailf render timed out." };
    }

    const cached = lastPoll.get(taskId);
    if (cached && Date.now() - cached.at < POLL_INTERVAL_MS) {
      return cached.status;
    }

    let update: ProviderStatus;
    try {
      const cfg = config();
      const response = await fetch(`${cfg.baseUrl}/v1/videos/${taskId}`, {
        headers: { authorization: `Bearer ${cfg.apiKey}` },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) {
        if (response.status >= 400 && response.status < 500) {
          return { status: "failed", error: `Sailf task query ${response.status}: ${await failureDetail(response)}` };
        }
        update = { status: "running" };
      } else {
        const task = (await response.json()) as SailfTask;
        const status = String(task.status || task.phase || "").toLowerCase();
        if (FAILED_STATUSES.has(status)) {
          return { status: "failed", error: taskFailure(task) };
        }
        const settled = COMPLETED_STATUSES.has(status) || task.terminal === true;
        const ready = settled && task.cdn_pending !== true && task.is_final !== false && task.stage !== "downloading";
        if (ready) {
          try {
            await downloadResult(cfg, taskId, jobId);
            lastPoll.delete(taskId);
            return { status: "done", resultUrl: `/api/jobs/${jobId}/result`, resultMime: "video/mp4" };
          } catch {
            // The task is finished but the file is not fetchable yet; try again on the next poll.
            update = { status: "running" };
          }
        } else {
          update = { status: QUEUED_STATUSES.has(status) ? "pending" : "running" };
        }
      }
    } catch {
      // Upstream hiccup; keep waiting until the render timeout kicks in.
      update = { status: "running" };
    }

    lastPoll.set(taskId, { at: Date.now(), status: update });
    return update;
  },
};
