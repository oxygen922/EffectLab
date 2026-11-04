import { errorResponse, AppError } from "@/lib/errors";
import { applyCallback } from "@/lib/jobs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATUSES = new Set(["running", "done", "failed"]);

export async function POST(request: Request) {
  try {
    const configured = process.env.PROVIDER_WEBHOOK_SECRET;
    if (configured && request.headers.get("x-effectlab-provider-secret") !== configured) {
      throw new AppError("unauthorized", "Provider secret does not match.", 401);
    }
    const body = (await request.json().catch(() => null)) as {
      jobId?: string;
      providerJobId?: string;
      status?: string;
      error?: string;
    } | null;
    const providerJobId = request.headers.get("x-effectlab-provider-job") || body?.providerJobId || "";
    if (!body?.jobId || !providerJobId || !body.status || !STATUSES.has(body.status)) {
      throw new AppError("bad_request", "Expected jobId, provider job id, and a status.", 400);
    }
    const job = await applyCallback({
      jobId: body.jobId,
      providerJobId,
      status: body.status as "running" | "done" | "failed",
      error: body.error,
    });
    return Response.json({ ok: true, job });
  } catch (error) {
    return errorResponse(error);
  }
}
