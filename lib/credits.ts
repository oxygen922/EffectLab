import { randomUUID } from "crypto";
import { AppError } from "./errors";
import type { Database, JobRecord, LedgerEntry, UserRecord } from "./types";

export const DEFAULT_STARTER_CREDITS = 8;

export function starterCredits(): number {
  const raw = process.env.STARTER_CREDITS;
  if (!raw) return DEFAULT_STARTER_CREDITS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_STARTER_CREDITS;
  return Math.round(parsed);
}

export function ensureUser(db: Database, userId: string, now: string, starter = starterCredits()): UserRecord {
  const existing = db.users[userId];
  if (existing) return existing;
  const user: UserRecord = { id: userId, createdAt: now, balance: 0, held: 0 };
  db.users[userId] = user;
  pushEntry(db, {
    userId,
    type: "grant",
    amount: starter,
    jobId: null,
    note: "Starter credits",
    createdAt: now,
  });
  user.balance += starter;
  return user;
}

function pushEntry(
  db: Database,
  entry: Omit<LedgerEntry, "id">,
): LedgerEntry {
  const full: LedgerEntry = { id: randomUUID(), ...entry };
  db.ledger.push(full);
  return full;
}

export function holdCredits(
  db: Database,
  userId: string,
  amount: number,
  jobId: string,
  note: string,
  now: string,
): void {
  const user = db.users[userId];
  if (!user) throw new AppError("missing_user", "User session is missing.", 401);
  if (amount < 1) throw new AppError("bad_cost", "Credit cost must be at least 1.", 400);
  if (user.balance < amount) {
    const unit = amount === 1 ? "credit" : "credits";
    throw new AppError(
      "insufficient_credits",
      `This render costs ${amount} ${unit} and the balance is ${user.balance}.`,
      402,
    );
  }
  user.balance -= amount;
  user.held += amount;
  pushEntry(db, { userId, type: "hold", amount, jobId, note, createdAt: now });
}

export function captureHold(db: Database, job: JobRecord, now: string): void {
  if (job.creditsState !== "held") return;
  const user = db.users[job.userId];
  if (!user) throw new AppError("missing_user", "User session is missing.", 401);
  user.held = Math.max(0, user.held - job.creditCost);
  job.creditsState = "captured";
  pushEntry(db, {
    userId: job.userId,
    type: "capture",
    amount: job.creditCost,
    jobId: job.id,
    note: `Spent on ${job.templateName}`,
    createdAt: now,
  });
}

export function releaseHold(db: Database, job: JobRecord, now: string, note: string): void {
  if (job.creditsState !== "held") return;
  const user = db.users[job.userId];
  if (!user) throw new AppError("missing_user", "User session is missing.", 401);
  user.held = Math.max(0, user.held - job.creditCost);
  user.balance += job.creditCost;
  job.creditsState = "released";
  pushEntry(db, {
    userId: job.userId,
    type: "release",
    amount: job.creditCost,
    jobId: job.id,
    note,
    createdAt: now,
  });
}
