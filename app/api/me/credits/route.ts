import { starterCredits } from "@/lib/credits";
import { errorResponse } from "@/lib/errors";
import { getOrCreateUserId } from "@/lib/session";
import { mutate } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const userId = await getOrCreateUserId();
    const credits = await mutate((db) => {
      const user = db.users[userId];
      return {
        userId,
        balance: user?.balance ?? 0,
        held: user?.held ?? 0,
        starterGrant: starterCredits(),
      };
    });
    return Response.json(credits, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
