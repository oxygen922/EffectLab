import assert from "node:assert/strict";
import test from "node:test";
import { captureHold, ensureUser, holdCredits, releaseHold } from "../lib/credits";
import { AppError } from "../lib/errors";
import { emptyDatabase } from "../lib/store";
import type { JobRecord } from "../lib/types";

function job(partial: Partial<JobRecord> = {}): JobRecord {
  return {
    id: "job-1",
    userId: "user-1",
    templateId: "studio-slate",
    templateSlug: "studio-slate",
    templateName: "Studio Slate",
    status: "pending",
    creditCost: 2,
    creditsState: "held",
    provider: "mock",
    providerJobId: "mock_job-1",
    imageCount: 1,
    imagePaths: [],
    resultUrl: null,
    error: null,
    createdAt: "2026-11-04T00:00:00.000Z",
    updatedAt: "2026-11-04T00:00:00.000Z",
    ...partial,
  };
}

test("hold, capture, and release are idempotent at the terminal step", () => {
  const db = emptyDatabase();
  const now = "2026-11-04T00:00:00.000Z";
  ensureUser(db, "user-1", now, 5);
  holdCredits(db, "user-1", 2, "job-1", "Hold for Studio Slate", now);
  assert.equal(db.users["user-1"].balance, 3);
  assert.equal(db.users["user-1"].held, 2);

  const record = job();
  captureHold(db, record, now);
  captureHold(db, record, now);
  assert.equal(record.creditsState, "captured");
  assert.equal(db.users["user-1"].balance, 3);
  assert.equal(db.users["user-1"].held, 0);
  assert.equal(db.ledger.filter((entry) => entry.type === "capture").length, 1);

  const failed = job({ id: "job-2", creditsState: "held" });
  holdCredits(db, "user-1", 2, "job-2", "Hold", now);
  releaseHold(db, failed, now, "Returned after a failed render");
  releaseHold(db, failed, now, "Returned after a failed render");
  assert.equal(db.users["user-1"].balance, 3);
  assert.equal(db.users["user-1"].held, 0);
  assert.equal(db.ledger.filter((entry) => entry.type === "release").length, 1);
});

test("insufficient balance does not move credits", () => {
  const db = emptyDatabase();
  ensureUser(db, "user-1", "2026-11-04T00:00:00.000Z", 1);
  assert.throws(
    () => holdCredits(db, "user-1", 2, "job-x", "Hold", "2026-11-04T00:00:01.000Z"),
    (error: unknown) => error instanceof AppError && error.code === "insufficient_credits" && error.status === 402,
  );
  assert.equal(db.users["user-1"].balance, 1);
  assert.equal(db.users["user-1"].held, 0);
  assert.equal(db.ledger.some((entry) => entry.type === "hold"), false);
});
