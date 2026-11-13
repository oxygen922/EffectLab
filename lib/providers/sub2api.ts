import { mkdir, readdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { buildPrompt } from "../prompts";
import { RENDER_TYPES } from "../render-models";
import type { GenerateInput, ProviderStatus, VideoProvider } from "./types";

const DEFAULT_BASE_URL = "https://ai-net.clariontech.top/v1";
const DEFAULT_MODEL = "gemini-2.5-flash";
const REQUEST_TIMEOUT_MS = 120_000;
const RENDER_TIMEOUT_MS = 10 * 60_000;

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function resultsDir(): string {
  return path.join(process.cwd(), "data", "results");
}

function resultPath(jobId: string): string {
  return path.join(resultsDir(), `${jobId}.svg`);
}

function jobIdFromProviderId(providerJobId: string): string {
  return providerJobId.replace(/^sub2api_/, "");
}

export function extractSvg(text: string): string | null {
  const start = text.indexOf("<svg");
  const end = text.lastIndexOf("</svg>");
  if (start === -1 || end === -1 || end <= start) return null;
  const svg = text.slice(start, end + "</svg>".length);
  if (!svg.includes("</svg>") || svg.length < 200) return null;
  return svg;
}

async function readUploadsAsDataUrls(jobId: string): Promise<string[]> {
  const dir = path.join(process.cwd(), "data", "uploads", jobId);
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    throw new Error(`No uploaded photos found for job ${jobId}.`);
  }
  names.sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10));
  const urls: string[] = [];
  for (const name of names) {
    const ext = path.extname(name).slice(1).toLowerCase();
    const mime = MIME_BY_EXT[ext];
    if (!mime) continue;
    const bytes = await readFile(path.join(dir, name));
    urls.push(`data:${mime};base64,${bytes.toString("base64")}`);
  }
  return urls;
}

function svgCardPrompt(input: GenerateInput): string {
  return [
    buildPrompt(input),
    `You receive ${input.imageUrls.length} user photo(s). Render the scene above as ONE self-contained SVG motion card.`,
    "Rules:",
    "- Output ONLY the SVG markup. No markdown, no code fences, no commentary.",
    '- Root element: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 640">.',
    '- Use SMIL <animate>/<animateTransform> elements so the card plays as a looped animation (durations 2-5s, repeatCount="indefinite").',
    "- Describe the photos in one short caption line inside the SVG (subject, colors). Do not embed the photos.",
    "- Style: bold shapes, high contrast, dark background, playful hand-drawn feel.",
    "- Keep total markup under 6 KB.",
  ].join("\n");
}

async function callUpstream(parts: unknown[]): Promise<string> {
  const baseUrl = (process.env.SUB2API_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const model = process.env.SUB2API_MODEL || DEFAULT_MODEL;
  const apiKey = process.env.SUB2API_API_KEY;
  if (!apiKey) {
    throw new Error("SUB2API_API_KEY is not set. Add it to .env.local to use the sub2api provider.");
  }
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: parts }],
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Sub2API ${response.status}: ${body.slice(0, 300)}`);
  }
  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Sub2API returned an empty completion.");
  }
  return content;
}

export const sub2apiProvider: VideoProvider = {
  name: "sub2api",
  supportedRenderTypes: RENDER_TYPES,
  async generate(input) {
    const photoDataUrls = await readUploadsAsDataUrls(input.jobId);
    const parts: unknown[] = [{ type: "text", text: svgCardPrompt(input) }];
    for (const url of photoDataUrls) {
      parts.push({ type: "image_url", image_url: { url } });
    }
    const text = await callUpstream(parts);
    const svg = extractSvg(text);
    if (!svg) {
      throw new Error("Sub2API did not return a usable SVG animation.");
    }
    await mkdir(resultsDir(), { recursive: true });
    await writeFile(resultPath(input.jobId), svg, "utf8");
    return { providerJobId: `sub2api_${input.jobId}` };
  },
  async getStatus(providerJobId, startedAt): Promise<ProviderStatus> {
    const jobId = jobIdFromProviderId(providerJobId);
    try {
      const svg = await readFile(resultPath(jobId), "utf8");
      if (svg.includes("</svg>")) {
        return { status: "done", resultUrl: `/api/jobs/${jobId}/result` };
      }
    } catch {
      // Result not written yet; the render is still in flight or the job failed elsewhere.
    }
    const elapsed = Date.now() - Date.parse(startedAt);
    if (Number.isFinite(elapsed) && elapsed > RENDER_TIMEOUT_MS) {
      return { status: "failed", error: "Sub2API render timed out." };
    }
    return { status: "running" };
  },
};
