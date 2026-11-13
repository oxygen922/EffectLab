import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const SKIP = new Set(["node_modules", ".next", ".git", "uploads", "results"]);

function walk(dir: string, found: string[]) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, found);
    else if (/\.(mp4|webm|mov|m4v|avi|m3u8|gif)$/i.test(entry)) found.push(full);
  }
}

test("captured preview media only lives in public/previews", () => {
  const found: string[] = [];
  walk(process.cwd(), found);
  const allowed = [
    path.join(process.cwd(), "public", "previews") + path.sep,
    path.join(process.cwd(), "assets", "reference") + path.sep,
    path.join(process.cwd(), "assets", "base") + path.sep,
  ];
  const stray = found.filter((file) => !allowed.some((root) => file.startsWith(root)));
  assert.deepEqual(stray, []);
});
