import { errorResponse } from "@/lib/errors";
import { listJobs } from "@/lib/jobs";
import { getOrCreateUserId } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const userId = await getOrCreateUserId();
    const jobs = await listJobs(userId);
    return Response.json({ jobs }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
