import { findTemplate } from "@/lib/catalog";
import { resultSvg } from "@/lib/covers";
import { errorResponse } from "@/lib/errors";
import { requireOwnedJob } from "@/lib/jobs";
import { getOrCreateUserId } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
    const svg = resultSvg({
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
