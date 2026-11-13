import type { JobStatus } from "../types";

export type GenerateInput = {
  templateKey: string;
  imageUrls: string[];
  jobId: string;
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
  generate(input: GenerateInput): Promise<{ providerJobId: string }>;
  getStatus(providerJobId: string, startedAt: string): Promise<ProviderStatus>;
};
