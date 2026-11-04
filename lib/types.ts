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
  [key: string]: unknown;
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
