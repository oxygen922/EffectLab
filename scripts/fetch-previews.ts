/**
 * Collect public preview posters / preview videos from 8 AI trend catalogs.
 *
 * Run: npx tsx scripts/fetch-previews.ts
 *
 * Outputs:
 *   template-radar/latest/previews.json
 *   template-radar/latest/previews-report.json
 *   public/previews/<slug>-poster.<ext>
 *   public/previews/<slug>-preview.mp4
 *
 * Only public catalog pages are requested. No login, no API keys, no browser.
 */
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const ROOT = process.cwd();
const RADAR_PATH = path.join(ROOT, "template-radar", "latest", "templates.json");
const PREVIEWS_PATH = path.join(ROOT, "template-radar", "latest", "previews.json");
const REPORT_PATH = path.join(ROOT, "template-radar", "latest", "previews-report.json");
const OUT_DIR = path.join(ROOT, "public", "previews");

const PAGE_TIMEOUT_MS = 60_000;
const POSTER_TIMEOUT_MS = 30_000;
const VIDEO_TIMEOUT_MS = 60_000;
const MAX_POSTER_BYTES = 600 * 1024;
const MAX_VIDEO_BYTES = 2.5 * 1024 * 1024;
const VIDEO_BUDGET_BYTES = 60 * 1024 * 1024;
/** "A few videos" is enough: cap download attempts so slow CDNs cannot stall the run. */
const MAX_VIDEO_ATTEMPTS = 12;
const CONCURRENCY = 1;
const REQUEST_GAP_MS = 3_000;
const SITE_GAP_MS = 2_000;

type SiteConfig = {
  site: string;
  pageUrl: string;
  /** How the site exposes cards. Generic parser always runs; these add hints. */
  jsonLdList?: boolean;
  vidlarkJson?: boolean;
  dataIdCards?: boolean;
  nameFromSlug?: boolean;
  nameClassPattern?: string;
  skipVideoTags?: boolean;
  /** Rewrite a poster URL before download (e.g. starrd render -> object). */
  transformPoster?: (url: string) => string;
};

const SITES: SiteConfig[] = [
  {
    site: "viralvideoai",
    pageUrl: "https://viralvideoai.app/templates",
    jsonLdList: true,
  },
  { site: "vidlark", pageUrl: "https://vidlark.ai/effects", vidlarkJson: true },
  { site: "jumponthetrend", pageUrl: "https://jumponthetrend.app/" },
  {
    site: "makeviral",
    pageUrl: "https://www.makeviral.ai/templates",
    nameClassPattern: "tg-name",
    transformPoster: makeviralPoster,
  },
  {
    site: "starrd",
    pageUrl: "https://www.getstarrd.app/templates",
    transformPoster: starrdPoster,
    skipVideoTags: true,
  },
  {
    site: "mediaio",
    pageUrl: "https://www.media.io/video-effects/",
  },
  { site: "zooop", pageUrl: "https://zooop.ai/templates" },
  { site: "vellm", pageUrl: "https://vellm.app/explore", dataIdCards: true },
];

type RadarRow = {
  name?: string;
  name_norm?: string;
  source_site?: string;
  source_url?: string;
};

type RadarFile = { templates?: RadarRow[] };

type Card = {
  site: string;
  href: string | null;
  name: string | null;
  poster: string | null;
  video: string | null;
};

type PreviewItem = {
  name: string;
  name_norm: string;
  source_site: string;
  page_url: string;
  poster_url: string | null;
  video_url: string | null;
};

type FetchResult = {
  ok: boolean;
  status: number | null;
  body: string;
  partial: boolean;
  error: string | null;
  pageUrl: string;
};

type Counts = Record<string, number>;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function bump(map: Counts, key: string, by = 1): void {
  map[key] = (map[key] ?? 0) + by;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&#38;/g, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#47;/g, "/");
}

function stripTags(value: string): string {
  return decodeEntities(value.replace(/<!--[\s\S]*?-->/g, " ").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function absoluteUrl(raw: string | undefined | null, base: string): string | null {
  if (!raw) return null;
  let value = decodeEntities(raw.trim());
  if (!value || /^(data|blob|javascript|mailto|tel):/i.test(value)) return null;
  if (value.startsWith("//")) value = `https:${value}`;
  try {
    const url = new URL(value, base);
    if (!/^https?:$/.test(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function attr(tag: string, name: string): string | null {
  const re = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i");
  const match = re.exec(tag);
  if (!match) return null;
  return decodeEntities(match[1] ?? match[2] ?? "");
}

function cleanName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = stripTags(raw)
    .replace(/^\[?[A-Z]{2,}\]?\s*(?=[A-Z])/, "")
    .replace(/^(TRENDING|NEW|HOT|FEATURED|POPULAR)\b\s*/i, "")
    .replace(/,\s*\d+\s*of\s*\d+\s*$/i, "")
    .replace(/\s*[-–—]\s*reference video.*$/i, "")
    .replace(/\bby\s+@\S+.*$/i, "")
    .replace(/\s*[·|]\s*.*$/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!value) return null;
  if (/credits|photos?\s*$|videos?\s*$/i.test(value) && value.length > 40) return null;
  if (value.length > 120) return null;
  return value;
}

function nameFromSlug(slug: string): string {
  return slug
    .replace(/\.(html?|php)$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\bai\b/gi, "AI")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/** Task rule: lowercase, strip non-alphanumerics, drop trailing "ai", drop leading "the". */
function normalizeName(value: string): string {
  let norm = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (norm.endsWith("ai")) norm = norm.slice(0, -2);
  if (norm.startsWith("the")) norm = norm.slice(3);
  return norm;
}

/** Matches lib/import/build-catalog.ts slugify() so file names line up with catalog slugs. */
function slugify(value: string): string {
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

function slugFromHref(href: string | null): string | null {
  if (!href) return null;
  try {
    const pathname = new URL(href).pathname.replace(/\/+$/, "");
    const last = pathname.split("/").filter(Boolean).pop() ?? "";
    return last ? last.replace(/\.(html?|php)$/i, "") : null;
  } catch {
    return null;
  }
}

function isCatalogHref(href: string): boolean {
  return /\/templates?\/|\/effects?\/|\/trends?\/|\/template\/|\/video-effects\/|\.html?$/i.test(href);
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

async function fetchText(url: string, attempts = 3, timeout = PAGE_TIMEOUT_MS): Promise<FetchResult> {
  let lastStatus: number | null = null;
  let lastError: string | null = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const started = Date.now();
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "user-agent": UA,
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.9",
        },
      });
      lastStatus = res.status;
      if (!res.ok) {
        lastError = `http_${res.status}`;
        clearTimeout(timer);
        await sleep(1200);
        continue;
      }
      const chunks: Buffer[] = [];
      let partial = false;
      let received = 0;
      const declared = Number(res.headers.get("content-length"));
      try {
        for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
          const part = Buffer.from(chunk);
          chunks.push(part);
          received += part.length;
          if (Number.isFinite(declared) && declared > 0 && received >= declared) break;
          if (received > 12 * 1024 * 1024) break;
        }
      } catch (error) {
        partial = true;
        lastError = (error as Error).name === "AbortError" ? "timeout" : `stream_${(error as Error).message}`;
      }
      const body = Buffer.concat(chunks).toString("utf8");
      if (!partial) {
        return { ok: true, status: res.status, body, partial: false, error: null, pageUrl: res.url || url };
      }
      // Cloudflare pages are chunked; a large partial body is still usable for card parsing.
      if (body.length >= 60 * 1024) {
        console.log(`  partial response kept (${body.length} bytes, ${Date.now() - started}ms)`);
        return { ok: true, status: res.status, body, partial: true, error: lastError, pageUrl: res.url || url };
      }
      console.log(`  attempt ${attempt}/${attempts} incomplete (${body.length} bytes): ${lastError}`);
    } catch (error) {
      const cause = (error as { cause?: { message?: string; code?: string } }).cause;
      lastError =
        (error as Error).name === "AbortError"
          ? "timeout"
          : cause?.code || cause?.message || (error as Error).message;
    } finally {
      clearTimeout(timer);
    }
    if (attempt < attempts) await sleep(1200);
  }
  return { ok: false, status: lastStatus, body: "", partial: false, error: lastError, pageUrl: url };
}

// Global gate: at most CONCURRENCY in flight, starts spaced by REQUEST_GAP_MS.
let active = 0;
const waiters: Array<() => void> = [];
let lastStart = 0;
let startChain = Promise.resolve();

async function acquire(): Promise<void> {
  if (active >= CONCURRENCY) await new Promise<void>((resolve) => waiters.push(resolve));
  active += 1;
  const previous = startChain;
  startChain = previous.then(async () => {
    const wait = lastStart + REQUEST_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastStart = Date.now();
  });
  await startChain;
}

function release(): void {
  active -= 1;
  const next = waiters.shift();
  if (next) next();
}

async function gated<T>(task: () => Promise<T>): Promise<T> {
  await acquire();
  try {
    return await task();
  } finally {
    release();
  }
}

type DownloadResult =
  | { ok: true; bytes: number; contentType: string; buffer: Buffer }
  | { ok: false; reason: string; bytes: number; contentType?: string };

const CURL = process.platform === "win32" ? "curl.exe" : "curl";

/** Node's fetch stalls on some Cloudflare image responses; curl handles them reliably. */
function runCurl(args: string[], timeoutMs: number): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(
      CURL,
      args,
      { timeout: timeoutMs + 5_000, maxBuffer: 4 * 1024 * 1024, windowsHide: true },
      (error, stdout, stderr) => {
        resolve({
          code: error ? Number((error as { code?: number }).code) || 1 : 0,
          stdout: stdout ?? "",
          stderr: stderr ?? "",
        });
      },
    );
  });
}

async function readBody(
  url: string,
  _pageUrl: string,
  maxBytes: number,
  timeout: number,
): Promise<DownloadResult> {
  const temp = path.join(os.tmpdir(), `preview-dl-${Date.now()}-${Math.random().toString(16).slice(2)}.bin`);
  try {
    const args = [
      "-sS",
      "-L",
      "-4",
      "--max-time",
      String(Math.ceil(timeout / 1000)),
      "-A",
      UA,
      "-H",
      "Accept: image/*,video/*,*/*;q=0.8",
      "--max-filesize",
      String(maxBytes + 1),
      "-o",
      temp,
      "-w",
      "%{http_code}|%{content_type}|%{size_download}",
      url,
    ];
    let code = 0;
    let stdout = "";
    let stderr = "";
    // Cloudflare occasionally resets the first connection from this network; one retry recovers it.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      ({ code, stdout, stderr } = await runCurl(args, timeout));
      if (code === 0 || code === 63) break;
      if ((code === 52 || code === 56) && attempt === 0) {
        await sleep(4_000);
        continue;
      }
      break;
    }
    if (code === 63) {
      return { ok: false, reason: `too_large_${maxBytes === MAX_POSTER_BYTES ? "poster" : "video"}`, bytes: 0 };
    }
    if (code === 28) {
      console.log(`  curl timeout: ${url.slice(0, 160)}${stderr ? ` | ${stderr.trim().slice(0, 120)}` : ""}`);
      return { ok: false, reason: "timeout", bytes: 0 };
    }
    if (code !== 0) return { ok: false, reason: `curl_exit_${code}`, bytes: 0 };

    const [statusRaw, typeRaw, sizeRaw] = stdout.trim().split("|");
    const status = Number(statusRaw);
    const contentType = (typeRaw ?? "").split(";")[0].trim().toLowerCase();
    if (!status || status >= 400) return { ok: false, reason: `http_${status || "unknown"}`, bytes: Number(sizeRaw) || 0 };
    if (!existsSync(temp)) return { ok: false, reason: "empty_body", bytes: 0 };
    const bytes = statSync(temp).size;
    if (!bytes) return { ok: false, reason: "empty_body", bytes: 0 };
    if (bytes > maxBytes) {
      return { ok: false, reason: `too_large_${maxBytes === MAX_POSTER_BYTES ? "poster" : "video"}`, bytes, contentType };
    }
    const buffer = readFileSync(temp);
    return { ok: true, bytes, contentType, buffer };
  } catch (error) {
    return { ok: false, reason: `curl_${(error as Error).message}`, bytes: 0 };
  } finally {
    rmSync(temp, { force: true });
  }
}

// ---------------------------------------------------------------------------
// HTML parsing
// ---------------------------------------------------------------------------

function videoAttrs(tag: string): { poster: string | null; video: string | null } {
  const poster = attr(tag, "poster") ?? attr(tag, "data-poster");
  const video =
    attr(tag, "src") ??
    attr(tag, "data-loop") ??
    attr(tag, "data-preview") ??
    attr(tag, "data-video") ??
    attr(tag, "data-src") ??
    attr(tag, "data-original");
  return { poster, video };
}

function hrefBeforeVideo(html: string, index: number): string | null {
  const before = html.slice(Math.max(0, index - 5000), index);
  const matches = [...before.matchAll(/href\s*=\s*"([^"]+)"/gi)].map((match) => decodeEntities(match[1]));
  for (let cursor = matches.length - 1; cursor >= 0; cursor -= 1) {
    if (isCatalogHref(matches[cursor])) return matches[cursor];
  }
  const after = html.slice(index, index + 1200);
  const next = [...after.matchAll(/href\s*=\s*"([^"]+)"/gi)]
    .map((match) => decodeEntities(match[1]))
    .find((href) => isCatalogHref(href));
  return next ?? null;
}

function nearestHref(context: string): string | null {
  const matches = [...context.matchAll(/href\s*=\s*"([^"]+)"/gi)];
  if (!matches.length) return null;
  // Prefer catalog-looking hrefs; choose the closest one to the middle of the window.
  const middle = context.length / 2;
  let best: { value: string; distance: number } | null = null;
  for (const match of matches) {
    const value = decodeEntities(match[1]);
    if (!isCatalogHref(value)) continue;
    const index = match.index ?? 0;
    const distance = Math.abs(index - middle);
    if (!best || distance < best.distance) best = { value, distance };
  }
  return best?.value ?? null;
}

function nearestHeading(context: string, nameClassPattern?: string): string | null {
  if (nameClassPattern) {
    const classRe = new RegExp(`<span[^>]*class="[^"]*${nameClassPattern}[^"]*"[^>]*>([\\s\\S]*?)</span>`, "i");
    const match = classRe.exec(context);
    if (match) {
      const name = cleanName(match[1]);
      if (name) return name;
    }
  }
  const heading = /<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/i.exec(context);
  if (heading) {
    const name = cleanName(heading[1]);
    if (name) return name;
  }
  return null;
}

function normalizeCard(card: Card, config: SiteConfig, pageUrl: string): Card | null {
  const href = absoluteUrl(card.href, pageUrl);
  const poster = absoluteUrl(card.poster, pageUrl);
  const video = absoluteUrl(card.video, pageUrl);
  if (!href && !poster && !video) return null;
  if (href && !isCatalogHref(href) && !poster && !video) return null;
  if (poster && /\/(logo|favicon|icon|avatar)[^/]*\.(svg|png|webp|jpg)/i.test(poster)) {
    return null;
  }
  let name = cleanName(card.name);
  if (!name && config.nameFromSlug) {
    const slug = slugFromHref(href);
    if (slug) name = nameFromSlug(slug);
  }
  if (!name) {
    const slug = slugFromHref(href);
    if (slug) name = nameFromSlug(slug);
  }
  return { site: config.site, href, name, poster, video: video && /\.mp4(\?|$)/i.test(video) ? video : null };
}

function parseAnchors(html: string, config: SiteConfig, pageUrl: string): Card[] {
  const cards: Card[] = [];
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const attrs = match[1];
    const inner = match[2];
    const href = attr(attrs, "href");
    if (!href || !isCatalogHref(href)) continue;
    const aria = attr(attrs, "aria-label");
    const imgTag = /<img\b[^>]*>/i.exec(inner)?.[0] ?? "";
    const imgSrc = attr(imgTag, "src");
    const imgAlt = attr(imgTag, "alt");
    const videoTag = /<video\b[^>]*>/i.exec(inner)?.[0] ?? "";
    let { poster, video } = videoAttrs(videoTag);
    if (!video) {
      const sourceTag = /<source\b[^>]*>/i.exec(inner)?.[0] ?? "";
      video = attr(sourceTag, "src");
    }
    if (!video) {
      const preview = /data-preview\s*=\s*"([^"]+)"/i.exec(inner);
      if (preview) video = decodeEntities(preview[1]);
    }
    const name =
      nearestHeading(inner, config.nameClassPattern) ??
      cleanName(imgAlt) ??
      cleanName(aria) ??
      cleanName(stripTags(inner));
    cards.push({ site: config.site, href, name, poster: imgSrc ?? poster, video });
  }
  return cards;
}

function parseVideoTags(html: string, config: SiteConfig, pageUrl: string): Card[] {
  const cards: Card[] = [];
  const re = /<video\b([^>]*)>([\s\S]*?)<\/video>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const tag = `<video${match[1]}>`;
    let { poster, video } = videoAttrs(tag);
    if (!video) {
      const sourceTag = /<source\b[^>]*>/i.exec(match[2])?.[0] ?? "";
      video = attr(sourceTag, "src");
    }
    const start = Math.max(0, (match.index ?? 0) - 1600);
    const end = Math.min(html.length, (match.index ?? 0) + match[0].length + 1600);
    const context = html.slice(start, end);
    const href = hrefBeforeVideo(html, match.index ?? 0) ?? nearestHref(context);
    const aria = attr(match[1], "aria-label");
    const image = /<img\b[^>]*>/i.exec(context)?.[0] ?? "";
    const name =
      cleanName(aria) ??
      nearestHeading(context, config.nameClassPattern) ??
      cleanName(attr(image, "alt"));
    cards.push({ site: config.site, href, name, poster: poster ?? attr(image, "src"), video });
  }
  return cards;
}

function parseImages(html: string, config: SiteConfig, pageUrl: string): Card[] {
  const cards: Card[] = [];
  const re = /<img\b([^>]*)>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const tag = `<img${match[1]}>`;
    const src = attr(tag, "src");
    if (!src || /\.svg(\?|$)/i.test(src)) continue;
    const alt = cleanName(attr(tag, "alt"));
    if (!alt) continue;
    const start = Math.max(0, (match.index ?? 0) - 900);
    const end = Math.min(html.length, (match.index ?? 0) + 900);
    const context = html.slice(start, end);
    const href = nearestHref(context);
    if (!href) continue;
    cards.push({ site: config.site, href, name: alt, poster: src, video: null });
  }
  return cards;
}

function parseDataIdCards(html: string, config: SiteConfig, pageUrl: string): Card[] {
  const cards: Card[] = [];
  const re = /<(section|article|div)\b([^>]*data-id\s*=\s*"[^"]+"[^>]*)>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const attrs = match[2];
    const inner = match[3];
    const id = attr(attrs, "data-id");
    if (!id) continue;
    const imgTag = /<img\b[^>]*>/i.exec(inner)?.[0] ?? "";
    const poster = attr(imgTag, "src");
    if (!poster) continue;
    let video: string | null = null;
    const videoTag = /<video\b[^>]*>/i.exec(inner)?.[0] ?? "";
    if (videoTag) video = videoAttrs(videoTag).video;
    const name =
      nearestHeading(inner) ?? cleanName(attr(imgTag, "alt")) ?? cleanName(attr(attrs, "aria-label")) ?? nameFromSlug(id);
    cards.push({ site: config.site, href: `/templates/${id}`, name, poster, video });
  }
  return cards;
}

function parseJsonLdCards(html: string, config: SiteConfig, pageUrl: string): Card[] {
  const cards: Card[] = [];
  const re = /"@type"\s*:\s*"ListItem"[\s\S]{0,400}?"url"\s*:\s*"([^"]+)"[\s\S]{0,200}?"name"\s*:\s*"([^"]+)"[\s\S]{0,600}?"image"\s*:\s*"([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    cards.push({
      site: config.site,
      href: decodeEntities(match[1]),
      name: cleanName(decodeEntities(match[2])),
      poster: decodeEntities(match[3]),
      video: null,
    });
  }
  return cards;
}

function parseVidlarkJson(html: string, config: SiteConfig, pageUrl: string): Card[] {
  const cards: Card[] = [];
  const decoded = html.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  const re = /"key":"([^"]+)","href":"([^"]+)","name":"([^"]+)"[\s\S]{0,500}?"styles":\[\{"key":"[^"]*","name":"[^"]*","poster":"([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(decoded))) {
    const tail = decoded.slice(match.index, match.index + 900);
    const video = /"video":"(https?:[^"]+\.mp4)"/i.exec(tail)?.[1] ?? null;
    cards.push({
      site: config.site,
      href: decodeEntities(match[2]),
      name: cleanName(decodeEntities(match[3])),
      poster: decodeEntities(match[4]),
      video,
    });
  }
  return cards;
}

function mediaUrls(html: string, pageUrl: string): { videos: string[]; posters: string[] } {
  const videos = new Set<string>();
  const posters = new Set<string>();
  const decoded = html.replace(/\\\//g, "/").replace(/\\"/g, '"');
  for (const match of decoded.matchAll(/https?:\/\/[^"'\s<>\\]+\.mp4(?:\?[^"'\s<>\\]*)?/gi)) {
    const url = absoluteUrl(match[0], pageUrl);
    if (url) videos.add(url);
  }
  for (const match of decoded.matchAll(/(?:https?:\/\/|\/)[^"'\s<>\\]+\.(?:webp|jpg|jpeg|png)(?:\?[^"'\s<>\\]*)?/gi)) {
    const url = absoluteUrl(match[0], pageUrl);
    if (url && !/\.svg/i.test(url)) posters.add(url);
  }
  return { videos: [...videos], posters: [...posters] };
}

function associateBySlug(cards: Card[], videos: string[], posters: string[]): void {
  const videoNames = videos.map((url) => ({
    url,
    base: (url.split("?")[0].split("/").pop() ?? "").toLowerCase(),
  }));
  const posterNames = posters.map((url) => ({
    url,
    base: (url.split("?")[0].split("/").pop() ?? "").toLowerCase(),
  }));
  for (const card of cards) {
    const slug = slugFromHref(card.href);
    if (!slug || slug.length < 4) continue;
    const lower = slug.toLowerCase();
    if (!card.video) {
      const found = videoNames.find(
        (entry) => entry.base.startsWith(`${lower}-`) || entry.base.startsWith(`${lower}.`) || entry.base === `${lower}.mp4`,
      );
      if (found) card.video = found.url;
    }
    if (!card.poster) {
      const found = posterNames.find(
        (entry) => entry.base.startsWith(`${lower}-`) || entry.base.startsWith(`${lower}.`),
      );
      if (found) card.poster = found.url;
    }
  }
}

function mergeCards(cards: Card[]): Card[] {
  const byKey = new Map<string, Card>();
  for (const card of cards) {
    if (!card.href && !card.poster && !card.video) continue;
    const key = card.href ? `h:${card.href}` : `m:${card.poster ?? card.video}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...card });
      continue;
    }
    if (!existing.name && card.name) existing.name = card.name;
    if (!existing.poster && card.poster) existing.poster = card.poster;
    if (!existing.video && card.video) existing.video = card.video;
  }
  return [...byKey.values()].filter((card) => Boolean(card.poster || card.video || card.href));
}

function parseSite(html: string, config: SiteConfig, finalUrl: string): Card[] {
  const cards: Card[] = [];
  cards.push(...parseAnchors(html, config, finalUrl));
  if (!config.skipVideoTags) cards.push(...parseVideoTags(html, config, finalUrl));
  if (config.dataIdCards) cards.push(...parseDataIdCards(html, config, finalUrl));
  if (config.jsonLdList) cards.push(...parseJsonLdCards(html, config, finalUrl));
  if (config.vidlarkJson) cards.push(...parseVidlarkJson(html, config, finalUrl));

  const { videos, posters } = mediaUrls(html, finalUrl);
  associateBySlug(cards, videos, posters);

  if (cards.filter((card) => card.poster || card.video).length < 4) {
    cards.push(...parseImages(html, config, finalUrl));
  }

  return mergeCards(
    cards
      .map((card) => normalizeCard(card, config, finalUrl))
      .filter((card): card is Card => Boolean(card && (card.poster || card.video))),
  );
}

/** makeviral's /api/thumb just proxies a public S3 object; hitting S3 directly is much faster. */
function makeviralPoster(url: string): string {
  if (!url.includes("/api/thumb?")) return url;
  try {
    return new URL(url).searchParams.get("u") || url;
  } catch {
    return url;
  }
}

function starrdPoster(url: string): string {
  return url.replace("/storage/v1/render/image/", "/storage/v1/object/").replace(/\?.*$/, "");
}

// ---------------------------------------------------------------------------
// Radar + matching
// ---------------------------------------------------------------------------

type Group = {
  key: string;
  slug: string;
  norm: string;
  sites: Set<string>;
};

function buildGroups(rows: RadarRow[]): Group[] {
  const byKey = new Map<string, Group>();
  const usedSlugs = new Set<string>();
  for (const row of rows) {
    const key = (row.name_norm || row.name || "").trim().toLowerCase();
    if (!key) continue;
    let group = byKey.get(key);
    if (!group) {
      let slug = slugify(key);
      if (usedSlugs.has(slug)) {
        let suffix = 2;
        while (usedSlugs.has(`${slug}-${suffix}`)) suffix += 1;
        slug = `${slug}-${suffix}`;
      }
      usedSlugs.add(slug);
      group = { key, slug, norm: normalizeName(key), sites: new Set<string>() };
      byKey.set(key, group);
    }
    if (row.source_site) group.sites.add(row.source_site);
  }
  return [...byKey.values()];
}

type Match = { group: Group; item: PreviewItem; score: number };

function matchItems(groups: Group[], items: PreviewItem[]): Map<string, Array<{ group: Group; item: PreviewItem; score: number }>> {
  const exact = new Map<string, Group>();
  for (const group of groups) exact.set(group.norm, group);
  const candidates = new Map<string, Array<{ group: Group; item: PreviewItem; score: number }>>();

  for (const item of items) {
    const itemNorm = item.name_norm;
    const itemSlug = slugify(item.name);
    let group = exact.get(itemNorm);
    let score = group ? 3 : 0;
    if (!group) {
      for (const candidate of groups) {
        const shorter = itemNorm.length < candidate.norm.length ? itemNorm : candidate.norm;
        if (shorter.length < 6) continue;
        if (candidate.norm.startsWith(itemNorm) || itemNorm.startsWith(candidate.norm)) {
          const prefixScore = 2 + Math.min(itemNorm.length, candidate.norm.length) / 100;
          if (!group || prefixScore > score) {
            group = candidate;
            score = prefixScore;
          }
        }
      }
    }
    if (!group) {
      for (const candidate of groups) {
        const shorter = itemSlug.length < candidate.slug.length ? itemSlug : candidate.slug;
        if (shorter.length < 6) continue;
        if (candidate.slug.startsWith(itemSlug) || itemSlug.startsWith(candidate.slug)) {
          group = candidate;
          score = 1 + Math.min(itemSlug.length, candidate.slug.length) / 100;
          break;
        }
      }
    }
    if (!group) continue;
    if (group.sites.has(item.source_site)) score += 0.5;
    if (item.poster_url) score += 0.1;
    if (item.video_url) score += 0.05;
    const list = candidates.get(group.slug) ?? [];
    list.push({ group, item, score });
    candidates.set(group.slug, list);
  }

  for (const list of candidates.values()) {
    list.sort((a, b) => b.score - a.score);
  }
  return candidates;
}

// ---------------------------------------------------------------------------
// Downloads
// ---------------------------------------------------------------------------

function extFor(contentType: string): string | null {
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/jpeg" || contentType === "image/jpg") return "jpg";
  if (contentType === "image/png") return "png";
  return null;
}

type SiteStats = {
  site: string;
  page_url: string;
  http_status: number | null;
  page_partial: boolean;
  page_error: string | null;
  cards: number;
  matched_templates: number;
  posters_downloaded: number;
  videos_downloaded: number;
  failures: Counts;
  skips: Counts;
  bytes: { posters: number; videos: number };
};

type Outcome = {
  site: string;
  group: Group;
  posterOk: boolean;
  videoOk: boolean;
};

async function main(): Promise<void> {
  if (!existsSync(RADAR_PATH)) throw new Error(`Radar file missing: ${RADAR_PATH}`);
  mkdirSync(OUT_DIR, { recursive: true });

  const radar = JSON.parse(readFileSync(RADAR_PATH, "utf8")) as RadarFile;
  const rows = radar.templates ?? [];
  const groups = buildGroups(rows);
  console.log(`Radar rows: ${rows.length}; deduped templates: ${groups.length}`);

  const stats = new Map<string, SiteStats>();
  const allCards: Card[] = [];
  const pageErrors: string[] = [];
  const reusePreview = process.env.REUSE_PREVIEWS === "1" && existsSync(PREVIEWS_PATH);
  let cachedItems: PreviewItem[] = [];

  if (reusePreview) {
    cachedItems = (JSON.parse(readFileSync(PREVIEWS_PATH, "utf8")) as { items: PreviewItem[] }).items ?? [];
    console.log(`Reusing ${cachedItems.length} existing preview items (REUSE_PREVIEWS=1).`);
    const previousReport = existsSync(REPORT_PATH)
      ? (JSON.parse(readFileSync(REPORT_PATH, "utf8")) as {
          page_errors?: string[];
          sites?: Array<{
            site: string;
            http_status: number | null;
            page_partial: boolean;
            page_error: string | null;
          }>;
        })
      : null;
    pageErrors.push(...(previousReport?.page_errors ?? []));
    for (const config of SITES) {
      const previous = previousReport?.sites?.find((site) => site.site === config.site);
      stats.set(config.site, {
        site: config.site,
        page_url: config.pageUrl,
        http_status: previous?.http_status ?? null,
        page_partial: previous?.page_partial ?? false,
        page_error: previous?.page_error ?? null,
        cards: cachedItems.filter((item) => item.source_site === config.site).length,
        matched_templates: 0,
        posters_downloaded: 0,
        videos_downloaded: 0,
        failures: {},
        skips: {},
        bytes: { posters: 0, videos: 0 },
      });
    }
  } else {
    for (const [index, config] of SITES.entries()) {
      if (index > 0) await sleep(SITE_GAP_MS);
      console.log(`Fetching ${config.site}: ${config.pageUrl}`);
      const result = await fetchText(config.pageUrl);
      const cards = result.ok ? parseSite(result.body, config, result.pageUrl) : [];
      allCards.push(...cards);
      stats.set(config.site, {
        site: config.site,
        page_url: config.pageUrl,
        http_status: result.status,
        page_partial: result.partial,
        page_error: result.error,
        cards: cards.length,
        matched_templates: 0,
        posters_downloaded: 0,
        videos_downloaded: 0,
        failures: {},
        skips: {},
        bytes: { posters: 0, videos: 0 },
      });
      console.log(
        `  ${result.ok ? `HTTP ${result.status}${result.partial ? " (partial)" : ""}` : `FAILED: ${result.error}`}; cards=${cards.length}`,
      );
      if (!result.ok) pageErrors.push(`${config.site}: ${result.error}`);
    }
  }

  // Build previews.json items (all collected cards, deduped) unless reusing a previous dump.
  let items: PreviewItem[];
  if (reusePreview) {
    items = cachedItems;
  } else {
    items = [];
    const seen = new Set<string>();
    for (const card of allCards) {
      if (!card.name) continue;
      const norm = normalizeName(card.name);
      if (!norm) continue;
      const item: PreviewItem = {
        name: card.name,
        name_norm: norm,
        source_site: card.site,
        page_url: SITES.find((site) => site.site === card.site)?.pageUrl ?? "",
        poster_url: card.poster,
        video_url: card.video,
      };
      const key = [item.source_site, item.name_norm, item.poster_url ?? "", item.video_url ?? ""].join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(item);
    }
    items.sort((a, b) => a.source_site.localeCompare(b.source_site) || a.name_norm.localeCompare(b.name_norm));
    writeFileSync(PREVIEWS_PATH, `${JSON.stringify({ generated_at: new Date().toISOString(), items }, null, 2)}\n`);
    console.log(`Wrote ${items.length} preview items.`);
  }

  const matches = matchItems(groups, items);
  console.log(`Matched ${matches.size}/${groups.length} templates.`);

  // Assign cards to sites, then download posters and videos.
  const outcomes: Outcome[] = [];
  const hardFailures = new Map<string, number>();
  const SITE_FAILURE_LIMIT = 3;
  let videoBudgetLeft = VIDEO_BUDGET_BYTES;
  let totalPosterBytes = 0;
  let totalVideoBytes = 0;

  const plan = [...matches.values()].map((list) => ({ list, chosen: list[0] }));
  for (const entry of plan) {
    const stat = stats.get(entry.chosen.item.source_site);
    if (stat) stat.matched_templates += 1;
    outcomes.push({ site: entry.chosen.item.source_site, group: entry.chosen.group, posterOk: false, videoOk: false });
  }

  // Phase 1: posters. Keeping this separate stops slow video probes from blocking poster coverage.
  const posterTasks: Array<() => Promise<void>> = [];
  for (const { list } of plan) {
    posterTasks.push(async () => {
      for (const candidate of list.slice(0, 3)) {
        const url = candidate.item.poster_url;
        if (!url) continue;
        const statForItem = stats.get(candidate.item.source_site);
        if (!statForItem) continue;
        if ((hardFailures.get(candidate.item.source_site) ?? 0) >= SITE_FAILURE_LIMIT) {
          bump(statForItem.skips, "site_unreachable");
          break;
        }
        const target = candidate.group.slug;
        const already = ["webp", "jpg", "png"]
          .map((ext) => path.join(OUT_DIR, `${target}-poster.${ext}`))
          .find((file) => existsSync(file));
        if (already) {
          const outcome = outcomes.find((entry) => entry.group.slug === target);
          if (outcome) outcome.posterOk = true;
          const size = statSync(already).size;
          statForItem.posters_downloaded += 1;
          statForItem.bytes.posters += size;
          totalPosterBytes += size;
          break;
        }
        const siteConfig = SITES.find((site) => site.site === candidate.item.source_site);
        const finalUrl = siteConfig?.transformPoster ? siteConfig.transformPoster(url) : url;
        const result = await gated(() => readBody(finalUrl, candidate.item.page_url, MAX_POSTER_BYTES, POSTER_TIMEOUT_MS));
        if (!result.ok) {
          if (result.reason.startsWith("too_large")) bump(statForItem.skips, result.reason);
          else {
            bump(statForItem.failures, result.reason);
            if (/timeout|curl_exit_/.test(result.reason)) {
              hardFailures.set(candidate.item.source_site, (hardFailures.get(candidate.item.source_site) ?? 0) + 1);
            }
          }
          console.log(`  poster fail ${target}: ${result.reason}`);
          continue;
        }
        const ext = extFor(result.contentType);
        if (!ext) {
          bump(statForItem.skips, `content_type_${result.contentType || "unknown"}`);
          console.log(`  poster unsupported ${target}: ${result.contentType}`);
          continue;
        }
        const file = path.join(OUT_DIR, `${target}-poster.${ext}`);
        writeFileSync(file, result.buffer);
        statForItem.posters_downloaded += 1;
        statForItem.bytes.posters += Number(result.bytes);
        totalPosterBytes += Number(result.bytes);
        const outcome = outcomes.find((entry) => entry.group.slug === target);
        if (outcome) outcome.posterOk = true;
        break;
      }
    });
  }
  await Promise.all(posterTasks.map((task) => task()));
  console.log(`Posters done: ${outcomes.filter((entry) => entry.posterOk).length}/${plan.length}`);

  // Phase 2: videos, capped by per-file size and the global 60 MB budget.
  const VIDEO_SITE_PRIORITY: Record<string, number> = {
    vidlark: 0,
    starrd: 1,
    vellm: 2,
    viralvideoai: 3,
    makeviral: 4,
    jumponthetrend: 5,
    zooop: 6,
    mediaio: 7,
  };
  const priority = (site: string) => VIDEO_SITE_PRIORITY[site] ?? 9;
  const videoPlan = [...plan].sort(
    (a, b) => priority(a.chosen.item.source_site) - priority(b.chosen.item.source_site),
  );
  const videoTasks: Array<() => Promise<void>> = [];
  let videoAttempts = 0;
  for (const { list } of videoPlan) {
    videoTasks.push(async () => {
      for (const candidate of list.slice(0, 2)) {
        const url = candidate.item.video_url;
        if (!url) continue;
        const statForItem = stats.get(candidate.item.source_site);
        if (!statForItem) continue;
        if ((hardFailures.get(candidate.item.source_site) ?? 0) >= SITE_FAILURE_LIMIT) {
          bump(statForItem.skips, "site_unreachable");
          break;
        }
        const target = candidate.group.slug;
        const file = path.join(OUT_DIR, `${target}-preview.mp4`);
        if (existsSync(file)) {
          const outcome = outcomes.find((entry) => entry.group.slug === target);
          if (outcome) outcome.videoOk = true;
          const size = statSync(file).size;
          statForItem.videos_downloaded += 1;
          statForItem.bytes.videos += size;
          totalVideoBytes += size;
          break;
        }
        if (videoBudgetLeft <= 0) {
          bump(statForItem.skips, "video_budget_exhausted");
          break;
        }
        if (videoAttempts >= MAX_VIDEO_ATTEMPTS) {
          bump(statForItem.skips, "video_attempt_cap");
          break;
        }
        videoAttempts += 1;
        const result = await gated(() => readBody(url, candidate.item.page_url, MAX_VIDEO_BYTES, VIDEO_TIMEOUT_MS));
        if (!result.ok) {
          if (result.reason.startsWith("too_large")) bump(statForItem.skips, "video_over_2_5mb");
          else {
            bump(statForItem.failures, result.reason);
            if (/timeout|curl_exit_/.test(result.reason)) {
              hardFailures.set(candidate.item.source_site, (hardFailures.get(candidate.item.source_site) ?? 0) + 1);
            }
          }
          console.log(`  video fail ${target}: ${result.reason}`);
          continue;
        }
        if (Number(result.bytes) > videoBudgetLeft) {
          bump(statForItem.skips, "video_budget_exhausted");
          break;
        }
        videoBudgetLeft -= Number(result.bytes);
        const temp = `${file}.tmp`;
        writeFileSync(temp, result.buffer);
        renameSync(temp, file);
        statForItem.videos_downloaded += 1;
        statForItem.bytes.videos += Number(result.bytes);
        totalVideoBytes += Number(result.bytes);
        const outcome = outcomes.find((entry) => entry.group.slug === target);
        if (outcome) outcome.videoOk = true;
        break;
      }
    });
  }
  await Promise.all(videoTasks.map((task) => task()));

  const withPoster = outcomes.filter((outcome) => outcome.posterOk).length;
  const withVideo = outcomes.filter((outcome) => outcome.videoOk).length;
  const coverage = groups.length ? withPoster / groups.length : 0;

  const siteReports = [...stats.values()].map((stat) => ({
    site: stat.site,
    page_url: stat.page_url,
    http_status: stat.http_status,
    page_partial: stat.page_partial,
    page_error: stat.page_error,
    cards: stat.cards,
    matched_templates: stat.matched_templates,
    posters_downloaded: stat.posters_downloaded,
    videos_downloaded: stat.videos_downloaded,
    failures: stat.failures,
    skips: stat.skips,
    bytes: stat.bytes,
  }));

  const report = {
    generated_at: new Date().toISOString(),
    coverage: {
      radar_rows: rows.length,
      deduped_templates: groups.length,
      templates_with_poster: withPoster,
      templates_with_video: withVideo,
      poster_ratio: Number(coverage.toFixed(4)),
    },
    totals: {
      sites_configured: SITES.length,
      sites_with_cards: siteReports.filter((site) => site.cards > 0).length,
      cards: allCards.length,
      preview_items: items.length,
      matched_templates: matches.size,
      posters_downloaded: siteReports.reduce((sum, site) => sum + site.posters_downloaded, 0),
      videos_downloaded: siteReports.reduce((sum, site) => sum + site.videos_downloaded, 0),
      poster_bytes: totalPosterBytes,
      video_bytes: totalVideoBytes,
      total_bytes: totalPosterBytes + totalVideoBytes,
    },
    budget: {
      video_budget_bytes: VIDEO_BUDGET_BYTES,
      video_budget_used: totalVideoBytes,
    },
    page_errors: pageErrors,
    sites: siteReports,
  };

  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

  console.log("\n=== Summary ===");
  for (const site of siteReports) {
    console.log(
      `${site.site}: HTTP ${site.http_status ?? "-"}; cards ${site.cards}; matched ${site.matched_templates}; posters ${site.posters_downloaded}; videos ${site.videos_downloaded}`,
    );
  }
  console.log(
    `Coverage: ${withPoster}/${groups.length} (${(coverage * 100).toFixed(1)}%); bytes ${(report.totals.total_bytes / 1024 / 1024).toFixed(2)} MB`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
