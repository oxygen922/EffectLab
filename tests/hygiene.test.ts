import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const SKIP = new Set(["node_modules", ".next", ".git", "uploads"]);

function walk(dir: string, found: string[]) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, found);
    else if (/\.(mp4|webm|mov|m4v|avi|m3u8|gif)$/i.test(entry)) found.push(full);
  }
}

test("the repo does not carry competitor or sample media files", () => {
  const found: string[] = [];
  walk(process.cwd(), found);
  assert.deepEqual(found, []);
});
