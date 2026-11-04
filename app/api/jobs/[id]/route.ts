import { errorResponse } from "@/lib/errors";
import { readJob } from "@/lib/jobs";
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
    const job = await readJob(userId, id);
    if (!job) {
      return Response.json({ error: "Job not found.", code: "not_found" }, { status: 404 });
    }
    return Response.json({ job }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
