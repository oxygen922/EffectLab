import { claimDailyCredits, ensureUser, starterCredits } from "@/lib/credits";
import { errorResponse } from "@/lib/errors";
import { getOrCreateUserId } from "@/lib/session";
import { mutate } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const userId = await getOrCreateUserId();
    const credits = await mutate((db) => {
      const now = new Date().toISOString();
      ensureUser(db, userId, now);
      claimDailyCredits(db, userId, now);
      const user = db.users[userId];
      return {
        userId,
        balance: user.balance,
        held: user.held,
        starterGrant: starterCredits(),
      };
    });
    return Response.json(credits, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
