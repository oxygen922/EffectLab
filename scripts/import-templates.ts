import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import path from "path";
import { buildCatalog, FORBIDDEN_KEY } from "../lib/import/build-catalog";
import type { CatalogFile, EditorialFile, RadarFile } from "../lib/types";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function resolveRadarPath(): string {
  const fromArg = arg("--from");
  const candidates = [
    fromArg,
    process.env.TEMPLATES_JSON,
    path.join(process.cwd(), "template-radar", "latest", "templates.json"),
    "/workspace/template-radar/latest/templates.json",
  ].filter((value): value is string => Boolean(value));
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(
    "Radar export not found. Place metadata at template-radar/latest/templates.json or pass --from <file>.",
  );
}

function readJson<T>(file: string, fallback: T): T {
  if (!existsSync(file)) return fallback;
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

const VIDEO_URL = /\.(mp4|webm|mov|m4v|m3u8|avi)(\?|$)/i;

function assertCatalogClean(value: unknown, trail = "catalog"): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertCatalogClean(item, `${trail}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") {
    if (typeof value === "string" && VIDEO_URL.test(value)) {
      throw new Error(`Import refused a video URL at ${trail}.`);
    }
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEY.test(key)) {
      throw new Error(`Import refused forbidden field "${key}" at ${trail}.`);
    }
    assertCatalogClean(child, `${trail}.${key}`);
  }
}

const radarPath = resolveRadarPath();
const editorialPath = path.join(process.cwd(), "data", "editorial.json");
const outPath = path.join(process.cwd(), "data", "templates.json");

const radar = JSON.parse(readFileSync(radarPath, "utf8")) as RadarFile;
const editorial = readJson<EditorialFile>(editorialPath, {});
const existing = readJson<CatalogFile | null>(outPath, null);
const catalog = buildCatalog(radar, existing, editorial);

mkdirSync(path.dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(catalog, null, 2)}\n`);

assertCatalogClean(catalog);

console.log(
  `Imported ${catalog.template_count} templates from ${path.relative(process.cwd(), radarPath)} into data/templates.json`,
);
