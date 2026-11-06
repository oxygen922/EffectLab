import type {
  CatalogFile,
  EditorialFile,
  EditorialPatch,
  RadarFile,
  RadarTemplate,
  Template,
} from "../types";

const TAG_MAP: Record<string, string> = {
  week_page: "weekly",
  new_week: "new",
};

/** Canonical lookup key shared with the preview scraper (lowercase, alphanumeric, no leading "the", no trailing "ai"). */
export function matchKey(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "")
    .replace(/^the/, "")
    .replace(/ai$/, "");
}

const ALLOWED_TEMPLATE_KEYS = [
  "id",
  "name",
  "slug",
  "sites",
  "photo_count",
  "duration_sec",
  "tags",
  "category",
  "aspect_ratio",
  "first_seen",
  "cross_count",
  "priority",
  "credit_cost",
  "blurb",
  "featured",
  "origin",
  "cover",
  "video_url",
  "preview_poster_url",
] as const;

export function slugify(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "template";
}

export function stripMediaText(value: string): string {
  return value.trim();
}

function asPatch(value: EditorialFile[string]): EditorialPatch | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function mostCommon(values: string[]): string | null {
  if (values.length === 0) return null;
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best = values[0];
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

function mostCommonName(rows: RadarTemplate[], key: string): string {
  const names = rows.map((row) => row.name).filter((name): name is string => Boolean(name));
  const common = mostCommon(names) ?? key;
  const withoutAi = common.replace(/\s+ai$/i, "").trim();
  if (!withoutAi || withoutAi.toLowerCase() === common.toLowerCase()) return common;
  const shorter = names.find((name) => name.toLowerCase() === withoutAi.toLowerCase());
  if (shorter) return shorter;
  if (!key.endsWith(" ai")) return withoutAi;
  return common;
}

/** Exact YYYY-MM-DD only. Ranges such as 2026-10-24/2026-11-03 are ignored. */
export function exactDay(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
}

function hoursBetween(laterIso: string, day: string): number | null {
  const later = Date.parse(laterIso);
  const earlier = Date.parse(`${day}T00:00:00+08:00`);
  if (Number.isNaN(later) || Number.isNaN(earlier)) return null;
  return (later - earlier) / 36e5;
}

function cleanBlurb(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 280);
}

function cleanMediaUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function clampInt(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function sanitizeTemplate(input: Template): Template {
  const raw = input as unknown as Record<string, unknown>;
  const slug = slugify(String(raw.slug || raw.name || "template"));
  const sites = Array.isArray(raw.sites)
    ? [...new Set(raw.sites.map((site) => String(site).trim()).filter(Boolean))].sort()
    : [];
  const tags = Array.isArray(raw.tags)
    ? [...new Set(raw.tags.map((tag) => String(tag).trim()).filter(Boolean))].sort()
    : [];
  const template: Template = {
    id: slug,
    name: String(raw.name || slug),
    slug,
    sites,
    photo_count: clampInt(Number(raw.photo_count), 1, 8, 1),
    duration_sec: clampInt(Number(raw.duration_sec), 1, 180, 10),
    tags,
    category: raw.category ? String(raw.category) : null,
    aspect_ratio: raw.aspect_ratio ? String(raw.aspect_ratio) : "9:16",
    first_seen: exactDay(raw.first_seen),
    cross_count: clampInt(Number(raw.cross_count ?? sites.length), 0, 99, sites.length),
    priority: clampInt(Number(raw.priority), 0, 999, sites.length),
    credit_cost: clampInt(Number(raw.credit_cost), 1, 99, 1),
    blurb: cleanBlurb(typeof raw.blurb === "string" ? raw.blurb : null),
    featured: Boolean(raw.featured),
    origin: raw.origin === "manual" ? "manual" : "radar",
    cover: `/covers/${slug}`,
    video_url: cleanMediaUrl(raw.video_url),
    preview_poster_url: cleanMediaUrl(raw.preview_poster_url),
  };
  for (const key of Object.keys(template)) {
    if (!ALLOWED_TEMPLATE_KEYS.includes(key as (typeof ALLOWED_TEMPLATE_KEYS)[number])) {
      delete (template as Record<string, unknown>)[key];
    }
  }
  return template;
}

function applyEditorial(base: Template, patch: EditorialPatch): Template {
  const next: Template = { ...base, tags: [...base.tags] };
  if (typeof patch.name === "string" && patch.name.trim()) next.name = patch.name.trim();
  if (patch.blurb !== undefined) next.blurb = patch.blurb;
  if (typeof patch.credit_cost === "number") next.credit_cost = patch.credit_cost;
  if (typeof patch.featured === "boolean") next.featured = patch.featured;
  if (patch.category !== undefined) next.category = patch.category;
  if (typeof patch.priority === "number") next.priority = patch.priority;
  if (typeof patch.photo_count === "number") next.photo_count = patch.photo_count;
  if (typeof patch.duration_sec === "number") next.duration_sec = patch.duration_sec;
  if (Array.isArray(patch.tags)) next.tags = patch.tags.map(String);
  if (Array.isArray(patch.tags_add)) {
    next.tags = [...new Set([...next.tags, ...patch.tags_add.map(String)])];
  }
  if (!base.sites.length && patch.origin === "manual") next.origin = "manual";
  if (base.origin === "manual") next.origin = "manual";
  if (patch.video_url !== undefined) next.video_url = cleanMediaUrl(patch.video_url);
  if (patch.preview_poster_url !== undefined) {
    next.preview_poster_url = cleanMediaUrl(patch.preview_poster_url);
  }
  return sanitizeTemplate(next);
}

function blankManual(slug: string, patch: EditorialPatch): Template {
  return sanitizeTemplate({
    id: slug,
    name: patch.name || slug,
    slug,
    sites: [],
    photo_count: patch.photo_count ?? 1,
    duration_sec: patch.duration_sec ?? 8,
    tags: patch.tags ?? ["original"],
    category: patch.category ?? "lab",
    aspect_ratio: "9:16",
    first_seen: null,
    cross_count: 0,
    priority: patch.priority ?? 1,
    credit_cost: patch.credit_cost ?? 1,
    blurb: patch.blurb ?? null,
    featured: patch.featured ?? false,
    origin: "manual",
    cover: `/covers/${slug}`,
    video_url: null,
    preview_poster_url: null,
  });
}

function mapTag(tag: string): string {
  return TAG_MAP[tag] ?? tag;
}

function groupKey(row: RadarTemplate): string {
  return (row.name_norm || row.name || "").trim().toLowerCase();
}

export function buildCatalog(
  radar: RadarFile,
  existing: CatalogFile | null,
  editorial: EditorialFile,
  generatedAt = new Date().toISOString(),
): CatalogFile {
  const groups = new Map<string, RadarTemplate[]>();
  for (const raw of radar.templates ?? []) {
    const row = raw;
    const key = groupKey(row);
    if (!key) continue;
    const bucket = groups.get(key);
    if (bucket) bucket.push(row);
    else groups.set(key, [row]);
  }

  const scrapedAt = radar.scraped_at ?? generatedAt;
  const usedSlugs = new Set<string>();
  const bySlug = new Map<string, Template>();

  for (const [key, rows] of groups) {
    let slug = slugify(key);
    if (usedSlugs.has(slug)) {
      let n = 2;
      while (usedSlugs.has(`${slug}-${n}`)) n += 1;
      slug = `${slug}-${n}`;
    }
    usedSlugs.add(slug);

    const sites = new Set<string>();
    const tags = new Set<string>();
    const photos: number[] = [];
    const durations: number[] = [];
    const categories: string[] = [];
    const ratios: string[] = [];
    const days: string[] = [];
    let posterUrl: string | null = null;
    let videoUrl: string | null = null;

    for (const row of rows) {
      if (row.source_site) sites.add(String(row.source_site));
      for (const site of row.cross_sites ?? []) sites.add(String(site));
      for (const tag of row.tags ?? []) {
        if (tag) tags.add(mapTag(String(tag)));
      }
      if (typeof row.photos_required === "number") photos.push(row.photos_required);
      if (typeof row.duration_sec === "number") durations.push(row.duration_sec);
      if (row.category) categories.push(String(row.category));
      if (row.aspect_ratio) ratios.push(String(row.aspect_ratio));
      const day = exactDay(row.listed_at);
      if (day) days.push(day);
      posterUrl ??= cleanMediaUrl(
        row.preview_poster_url ?? row.preview ?? row.poster ?? row.preview_image_url,
      );
      videoUrl ??= cleanMediaUrl(row.video_url ?? row.sample_url ?? null);
    }

    const siteList = [...sites].filter(Boolean).sort();
    const cross = siteList.length;
    const firstSeen = days.sort()[0] ?? null;
    let priority = cross;
    if (cross >= 4) priority += 5;
    const ageHours = firstSeen ? hoursBetween(scrapedAt, firstSeen) : null;
    if (ageHours !== null && ageHours >= 0 && ageHours <= 48) priority += 8;
    else if (ageHours !== null && ageHours >= 0 && ageHours <= 24 * 7) priority += 3;

    const photoCount = photos.length ? Math.max(...photos) : 1;
    const duration = median(durations) ?? 10;

    bySlug.set(
      slug,
      sanitizeTemplate({
        id: slug,
        name: mostCommonName(rows, key),
        slug,
        sites: siteList,
        photo_count: photoCount,
        duration_sec: duration,
        tags: [...tags],
        category: mostCommon(categories),
        aspect_ratio: mostCommon(ratios) ?? "9:16",
        first_seen: firstSeen,
        cross_count: cross,
        priority,
        credit_cost: 1,
        blurb: null,
        featured: false,
        origin: "radar",
        cover: `/covers/${slug}`,
        video_url: videoUrl,
        preview_poster_url: posterUrl,
      }),
    );
  }

  for (const row of existing?.templates ?? []) {
    if (row.origin !== "manual" || bySlug.has(row.slug)) continue;
    bySlug.set(row.slug, sanitizeTemplate(row));
  }

  for (const [key, value] of Object.entries(editorial)) {
    if (key.startsWith("_")) continue;
    const patch = asPatch(value);
    if (!patch) continue;
    const base = bySlug.get(key) ?? blankManual(key, patch);
    const merged = applyEditorial(base, patch);
    if (patch.hidden) {
      bySlug.delete(key);
      continue;
    }
    bySlug.set(key, merged);
  }

  const templates = [...bySlug.values()]
    .map((template) => sanitizeTemplate(template))
    .sort(
      (a, b) =>
        b.priority - a.priority ||
        b.cross_count - a.cross_count ||
        a.name.localeCompare(b.name),
    );

  return {
    schema_version: 1,
    generated_at: generatedAt,
    source: "template-radar/latest/templates.json",
    source_scraped_at: radar.scraped_at ?? null,
    template_count: templates.length,
    note: "Template metadata plus preview posters and videos captured from public catalog pages.",
    templates,
  };
}
