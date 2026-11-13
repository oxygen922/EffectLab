import { existsSync, readFileSync } from "fs";
import path from "path";
import type { RenderType } from "./render-models";

export type ModelCitation = {
  site: string;
  url: string;
  stated: string;
};

export type RenderRecord = {
  renderType: RenderType;
  reason: string;
  /** Repo-relative path, or null until a licensed or self-recorded file exists. */
  referenceVideo: string | null;
  /** Repo-relative path for a face-swap base clip, or null. */
  baseVideo: string | null;
  suggestedModel: string;
  modelSource: "source_page" | "inferred";
  modelReason: string;
  citations: ModelCitation[];
  disagreements: ModelCitation[];
  alternates: string[];
};

export type RenderTypeFile = {
  schema_version: number;
  generated_at: string;
  note: string;
  templates: Record<string, RenderRecord>;
};

const VIDEO_EXT = [".mp4", ".mov", ".webm"];

let cache: RenderTypeFile | null = null;

export function renderTypesPath(): string {
  return path.join(process.cwd(), "data", "render-types.json");
}

export function loadRenderTypes(): RenderTypeFile {
  if (!cache) cache = JSON.parse(readFileSync(renderTypesPath(), "utf8")) as RenderTypeFile;
  return cache;
}

export function findRenderRecord(slug: string): RenderRecord | null {
  return loadRenderTypes().templates[slug] ?? null;
}

export function requireRenderRecord(slug: string): RenderRecord {
  const record = findRenderRecord(slug);
  if (!record) throw new Error(`No render type recorded for template "${slug}".`);
  return record;
}

export function assetDir(kind: "reference" | "base"): string {
  return path.join(process.cwd(), "assets", kind);
}

/** On-disk motion or base clip for a slug, if someone has added a licensed file. */
export function findAssetFile(slug: string, kind: "reference" | "base"): string | null {
  const record = findRenderRecord(slug);
  const recorded = kind === "reference" ? record?.referenceVideo : record?.baseVideo;
  if (recorded) {
    const full = path.isAbsolute(recorded) ? recorded : path.join(process.cwd(), recorded);
    if (existsSync(full)) return full;
  }
  const dir = assetDir(kind);
  for (const ext of VIDEO_EXT) {
    const full = path.join(dir, `${slug}${ext}`);
    if (existsSync(full)) return full;
  }
  return null;
}
