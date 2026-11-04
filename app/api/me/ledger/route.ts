import { errorResponse } from "@/lib/errors";
import { getOrCreateUserId } from "@/lib/session";
import { mutate } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const userId = await getOrCreateUserId();
    const payload = await mutate((db) => {
      const user = db.users[userId];
      const entries = db.ledger
        .filter((entry) => entry.userId === userId)
        .slice()
        .reverse()
        .slice(0, 100);
      return {
        userId,
        balance: user?.balance ?? 0,
        held: user?.held ?? 0,
        entries,
      };
    });
    return Response.json(payload, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
