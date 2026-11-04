import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { ensureUser } from "./credits";
import { mutate } from "./store";

export const SESSION_COOKIE = "effectlab_uid";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export async function getOrCreateUserId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(SESSION_COOKIE)?.value;
  const userId = existing && isUuid(existing) ? existing : randomUUID();
  if (userId !== existing) {
    jar.set(SESSION_COOKIE, userId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 400,
    });
  }
  const now = new Date().toISOString();
  await mutate((db) => {
    ensureUser(db, userId, now);
  });
  return userId;
}
