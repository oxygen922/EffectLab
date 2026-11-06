import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import path from "path";
import { buildCatalog } from "../lib/import/build-catalog";
import type { CatalogFile, EditorialFile, RadarFile, Template } from "../lib/types";

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

const PREVIEW_DIR = path.join(process.cwd(), "public", "previews");
const POSTER_EXTS = ["webp", "jpg", "jpeg", "png"];

/** Preview files captured by scripts/fetch-previews.ts are cached under public/previews by slug. */
function findPoster(slug: string): string | null {
  for (const ext of POSTER_EXTS) {
    const file = path.join(PREVIEW_DIR, `${slug}-poster.${ext}`);
    if (existsSync(file)) return `/previews/${slug}-poster.${ext}`;
  }
  return null;
}

function findVideo(slug: string): string | null {
  const file = path.join(PREVIEW_DIR, `${slug}-preview.mp4`);
  return existsSync(file) ? `/previews/${slug}-preview.mp4` : null;
}

function withLocalPreviews(template: Template): Template {
  const poster = findPoster(template.slug);
  const video = findVideo(template.slug);
  if (!poster && !video) return template;
  return {
    ...template,
    preview_poster_url: template.preview_poster_url ?? poster,
    video_url: template.video_url ?? video,
  };
}

const radarPath = resolveRadarPath();
const editorialPath = path.join(process.cwd(), "data", "editorial.json");
const outPath = path.join(process.cwd(), "data", "templates.json");

const radar = JSON.parse(readFileSync(radarPath, "utf8")) as RadarFile;
const editorial = readJson<EditorialFile>(editorialPath, {});
const existing = readJson<CatalogFile | null>(outPath, null);
const catalog = buildCatalog(radar, existing, editorial);
const templates = catalog.templates.map(withLocalPreviews);
const output: CatalogFile = { ...catalog, templates };

mkdirSync(path.dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);

const withPoster = templates.filter((template) => template.preview_poster_url).length;
const withVideo = templates.filter((template) => template.video_url).length;

console.log(
  `Imported ${output.template_count} templates from ${path.relative(process.cwd(), radarPath)} into data/templates.json`,
);
console.log(`Preview posters: ${withPoster}/${output.template_count} · preview videos: ${withVideo}/${output.template_count}`);
