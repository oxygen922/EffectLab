import { errorResponse } from "@/lib/errors";
import { readJobImage } from "@/lib/jobs";
import { getOrCreateUserId } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; index: string }> },
) {
  try {
    const userId = await getOrCreateUserId();
    const { id, index } = await context.params;
    const imageIndex = Number(index);
    if (!Number.isInteger(imageIndex) || imageIndex < 0) {
      return Response.json({ error: "Image index is not valid.", code: "bad_request" }, { status: 400 });
    }
    const image = await readJobImage(userId, id, imageIndex);
    if (!image) {
      return Response.json({ error: "Image not found.", code: "not_found" }, { status: 404 });
    }
    return new Response(new Uint8Array(image.bytes), {
      headers: {
        "content-type": image.mime,
        "cache-control": "private, max-age=3600",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
