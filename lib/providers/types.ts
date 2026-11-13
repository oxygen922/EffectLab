import type { RenderType } from "../render-models";
import type { JobStatus } from "../types";

export type GenerateInput = {
  templateKey: string;
  imageUrls: string[];
  jobId: string;
  /** Effective pipeline after asset fallback. */
  renderType?: RenderType;
  /** Registry id, for example seedance-2.5 or kling-3.0-motion-control. */
  modelId?: string;
  /** Local reference or base video. Set only when renderType still needs it. */
  referenceVideoPath?: string | null;
};

export type ProviderStatus = {
  status: JobStatus;
  resultUrl?: string;
  /** Media type of the finished render, e.g. "video/mp4"; SVG renders leave it unset. */
  resultMime?: string;
  error?: string;
};

export type VideoProvider = {
  readonly name: string;
  readonly supportedRenderTypes: readonly RenderType[];
  generate(input: GenerateInput): Promise<{ providerJobId: string }>;
  getStatus(providerJobId: string, startedAt: string): Promise<ProviderStatus>;
};
