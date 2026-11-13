export type TemplateOrigin = "radar" | "manual";

export type Template = {
  id: string;
  name: string;
  slug: string;
  sites: string[];
  photo_count: number;
  duration_sec: number;
  tags: string[];
  category: string | null;
  aspect_ratio: string;
  first_seen: string | null;
  cross_count: number;
  priority: number;
  credit_cost: number;
  blurb: string | null;
  featured: boolean;
  origin: TemplateOrigin;
  cover: string;
  /** Local cached preview video, captured from the public catalog pages. */
  video_url: string | null;
  /** Local cached preview poster, captured from the public catalog pages. */
  preview_poster_url: string | null;
};

export type CatalogFile = {
  schema_version: number;
  generated_at: string;
  source: string;
  source_scraped_at: string | null;
  template_count: number;
  note: string;
  templates: Template[];
};

export type EditorialPatch = {
  name?: string;
  blurb?: string | null;
  credit_cost?: number;
  featured?: boolean;
  hidden?: boolean;
  category?: string | null;
  priority?: number;
  photo_count?: number;
  duration_sec?: number;
  tags?: string[];
  tags_add?: string[];
  origin?: TemplateOrigin;
  video_url?: string | null;
  preview_poster_url?: string | null;
};

export type EditorialFile = Record<string, EditorialPatch | string | undefined>;

export type RadarTemplate = {
  id?: string;
  name?: string;
  name_norm?: string;
  source_site?: string;
  source_url?: string;
  photos_required?: number | null;
  duration_sec?: number | null;
  listed_at?: string | null;
  cross_site_count?: number;
  cross_sites?: string[];
  tags?: string[];
  category?: string | null;
  aspect_ratio?: string | null;
  preview_poster_url?: string | null;
  video_url?: string | null;
  sample_url?: string | null;
  preview?: string | null;
  poster?: string | null;
  [key: string]: unknown;
};

export type PreviewMedia = {
  poster_url: string | null;
  video_url: string | null;
};

/** What a registered generation tool does. */
export type ToolKind = "text-to-image" | "image-edit" | "image-to-video" | "text-to-video";

/** A model or service in the generation toolbox (data/recipes.json → tools). */
export type ToolInfo = {
  name: string;
  kind: ToolKind;
  /** Gateway/provider the tool is reachable through, e.g. a cheap-token relay. */
  provider?: string | null;
  notes?: string | null;
};

/** One stage of a template's generation pipeline. */
export type RecipeStep = {
  tool: string;
  action: string;
  input: string;
  output: string;
  params?: Record<string, string | number>;
};

/**
 * How a template is produced:
 * - "direct": photo goes straight into an image-to-video model, single pass.
 * - "storyboard": reference image / keyframe is generated first, then animated into video.
 */
export type TemplateRecipe = {
  pipeline: "direct" | "storyboard";
  /** "curated" recipes are hand-written; "auto" ones are category defaults pending review. */
  source: "curated" | "auto";
  steps: RecipeStep[];
  notes?: string | null;
};

export type RecipeFile = {
  schema_version: number;
  generated_at: string;
  tools: Record<string, ToolInfo>;
  recipes: Record<string, TemplateRecipe>;
};

/** How sure we are that a template prompt matches the public trend. */
export type PromptConfidence = "high" | "low";

/** Notes from the public pages or explainers used to write a prompt. */
export type PromptResearch = {
  sources: string[];
  /** Observed beats, paraphrased. Not a generation prompt. */
  beats: string;
};

/** One template's generation prompt, keyed by slug in data/prompts.json. */
export type TemplatePrompt = {
  prompt: string;
  promptConfidence: PromptConfidence;
  research: PromptResearch;
};

export type PromptFile = {
  schema_version: number;
  generated_at: string;
  note: string;
  prompts: Record<string, TemplatePrompt>;
};

export type PreviewFile = {
  generated_at?: string;
  items?: Array<{
    name?: string;
    name_norm?: string;
    source_site?: string;
    page_url?: string | null;
    poster_url?: string | null;
    video_url?: string | null;
    poster_local?: string | null;
    video_local?: string | null;
  }>;
};

export type RadarFile = {
  schema_version?: number;
  scraped_at?: string;
  templates?: RadarTemplate[];
};

export type LedgerType = "grant" | "hold" | "capture" | "release";

export type LedgerEntry = {
  id: string;
  userId: string;
  type: LedgerType;
  amount: number;
  jobId: string | null;
  note: string;
  createdAt: string;
};

export type UserRecord = {
  id: string;
  createdAt: string;
  balance: number;
  held: number;
  lastDailyGrant?: string | null;
};

export type JobStatus = "pending" | "running" | "done" | "failed";
export type CreditsState = "held" | "captured" | "released";

export type JobRecord = {
  id: string;
  userId: string;
  templateId: string;
  templateSlug: string;
  templateName: string;
  status: JobStatus;
  creditCost: number;
  creditsState: CreditsState;
  provider: string;
  providerJobId: string | null;
  imageCount: number;
  imagePaths: string[];
  resultUrl: string | null;
  /** Media type of the stored result; null means the built-in SVG render. */
  resultMime: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

export type JobPublic = {
  id: string;
  templateId: string;
  templateSlug: string;
  templateName: string;
  status: JobStatus;
  creditCost: number;
  creditsState: CreditsState;
  provider: string;
  imageCount: number;
  resultUrl: string | null;
  resultMime: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Database = {
  users: Record<string, UserRecord>;
  jobs: Record<string, JobRecord>;
  ledger: LedgerEntry[];
};

export type CreditsSnapshot = {
  userId: string;
  balance: number;
  held: number;
  starterGrant: number;
};

export const SITE_LABELS: Record<string, string> = {
  viralvideoai: "ViralVideoAI",
  vidlark: "Vidlark",
  jumponthetrend: "Jumponthetrend",
  makeviral: "MakeViral",
  starrd: "Starrd",
  mediaio: "media.io",
  zooop: "Zooop",
  vellm: "Vellm",
};

export function siteLabel(id: string): string {
  return SITE_LABELS[id] ?? id;
}
