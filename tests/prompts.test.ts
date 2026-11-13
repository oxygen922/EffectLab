import assert from "node:assert/strict";
import test from "node:test";
import { buildPrompt, loadPrompts } from "../lib/prompts";
import type { CatalogFile } from "../lib/types";
import { readFileSync } from "node:fs";

const catalog = JSON.parse(readFileSync("data/templates.json", "utf8")) as CatalogFile;

test("every catalog template has a non-empty prompt", () => {
  const prompts = loadPrompts();
  for (const template of catalog.templates) {
    const record = prompts.prompts[template.slug];
    assert.ok(record, `missing prompt record for ${template.slug}`);
    assert.equal(record.promptConfidence === "high" || record.promptConfidence === "low", true, template.slug);
    assert.ok(record.prompt.trim().length > 0, template.slug);
    assert.ok(record.research?.beats?.trim(), `${template.slug} needs a research note`);
    assert.ok(Array.isArray(record.research.sources), template.slug);
  }
  assert.equal(Object.keys(prompts.prompts).length, catalog.templates.length);
});

test("buildPrompt includes the template motion, not only the slug", () => {
  const stored = loadPrompts().prompts["bicep-heart"];
  const out = buildPrompt({ templateKey: "bicep-heart", imageUrls: [], jobId: "job_bicep" });
  assert.ok(out.includes(stored.prompt.slice(0, 80)));
  assert.match(out, /flex/i);
  assert.match(out, /heart/i);
  assert.match(out, /9:16/);
  assert.equal(out.startsWith("Animate the reference photo"), false);
  assert.equal(out.includes("bicep-heart"), false);
});

test("buildPrompt falls back and warns when a template has no prompt", () => {
  const warnings: string[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map(String).join(" "));
  };
  try {
    const out = buildPrompt({ templateKey: "missing-template", imageUrls: [], jobId: "job_missing" });
    assert.match(out, /Animate the reference photo\(s\) into the "missing-template" effect/);
    assert.match(out, /colours consistent with the reference/);
    assert.ok(warnings.some((line) => line.includes("missing-template") && line.includes("generic fallback")));
  } finally {
    console.warn = original;
  }
});
