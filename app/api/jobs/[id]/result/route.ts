import { readFile } from "fs/promises";
import path from "path";
import { findTemplate } from "@/lib/catalog";
import { resultSvg } from "@/lib/covers";
import { errorResponse } from "@/lib/errors";
import { requireOwnedJob } from "@/lib/jobs";
import { getOrCreateUserId } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function providerResult(jobId: string): Promise<string | null> {
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) return null;
  try {
    const svg = await readFile(path.join(process.cwd(), "data", "results", `${jobId}.svg`), "utf8");
    return svg.includes("</svg>") ? svg : null;
  } catch {
    return null;
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getOrCreateUserId();
    const { id } = await context.params;
    const job = await requireOwnedJob(userId, id);
    if (!job) {
      return Response.json({ error: "Job not found.", code: "not_found" }, { status: 404 });
    }
    if (job.status !== "done") {
      return Response.json(
        { error: "The render is not ready yet.", code: "not_ready" },
        { status: 409 },
      );
    }
    const template = findTemplate(job.templateSlug);
    const svg =
      (await providerResult(job.id)) ??
      resultSvg({
        templateName: job.templateName,
        photoCount: job.imageCount,
        durationSec: template?.duration_sec ?? 10,
      });
    return new Response(svg, {
      headers: {
        "content-type": "image/svg+xml; charset=utf-8",
        "cache-control": "private, max-age=3600",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
