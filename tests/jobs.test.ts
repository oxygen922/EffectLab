import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { mockStatus, MOCK_DONE_MS, MOCK_PENDING_MS } from "../lib/providers/mock";
import type { Template } from "../lib/types";

process.env.STARTER_CREDITS = "1";
process.env.EFFECTLAB_STORE = path.join(mkdtempSync(path.join(tmpdir(), "effectlab-")), "runtime.json");

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const template: Template = {
  id: "studio-slate",
  name: "Studio Slate",
  slug: "studio-slate",
  sites: [],
  photo_count: 1,
  duration_sec: 5,
  tags: ["original"],
  category: "lab",
  aspect_ratio: "9:16",
  first_seen: null,
  cross_count: 0,
  priority: 1,
  credit_cost: 1,
  blurb: "Slate",
  featured: false,
  origin: "manual",
  cover: "/covers/studio-slate",
  video_url: null,
  preview_poster_url: null,
};

test("mock status moves pending to running to done", () => {
  const started = "2026-11-04T00:00:00.000Z";
  const t0 = Date.parse(started);
  assert.equal(mockStatus("mock_abc", started, t0 + 100).status, "pending");
  assert.equal(mockStatus("mock_abc", started, t0 + MOCK_PENDING_MS + 10).status, "running");
  const done = mockStatus("mock_abc", started, t0 + MOCK_DONE_MS + 10);
  assert.equal(done.status, "done");
  assert.equal(done.resultUrl, "/api/jobs/abc/result");
});

test("parallel creates spend a single credit once and failure returns it", async () => {
  const { createGenerationJob, applyCallback } = await import("../lib/jobs");
  const { mutate } = await import("../lib/store");
  const { AppError } = await import("../lib/errors");

  const results = await Promise.allSettled([
    createGenerationJob({
      userId: "solo",
      template,
      files: [{ bytes: PNG, mime: "image/png" }],
    }),
    createGenerationJob({
      userId: "solo",
      template,
      files: [{ bytes: PNG, mime: "image/png" }],
    }),
  ]);
  const fulfilled = results.filter((result) => result.status === "fulfilled");
  const rejected = results.filter((result) => result.status === "rejected");
  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  const reason = rejected[0].status === "rejected" ? rejected[0].reason : null;
  assert.ok(reason instanceof AppError);
  assert.equal(reason.code, "insufficient_credits");

  const created = fulfilled[0].status === "fulfilled" ? fulfilled[0].value : null;
  assert.ok(created);
  const failed = await applyCallback({
    jobId: created.id,
    providerJobId: `mock_${created.id}`,
    status: "failed",
    error: "mock failure",
  });
  assert.equal(failed.status, "failed");
  assert.equal(failed.creditsState, "released");

  const again = await createGenerationJob({
    userId: "solo",
    template,
    files: [{ bytes: PNG, mime: "image/png" }],
  });
  const done = await applyCallback({
    jobId: again.id,
    providerJobId: `mock_${again.id}`,
    status: "done",
  });
  await applyCallback({
    jobId: again.id,
    providerJobId: `mock_${again.id}`,
    status: "done",
  });
  assert.equal(done.creditsState, "captured");
  assert.equal(done.resultUrl, `/api/jobs/${again.id}/result`);

  const wallet = await mutate((db) => db.users.solo);
  assert.equal(wallet.balance, 0);
  assert.equal(wallet.held, 0);
  const captures = await mutate((db) => db.ledger.filter((entry) => entry.userId === "solo" && entry.type === "capture"));
  assert.equal(captures.length, 1);
});
