import { RENDER_TYPES } from "../render-models";
import type { ProviderStatus, VideoProvider } from "./types";

export const MOCK_PENDING_MS = 1600;
export const MOCK_DONE_MS = 5200;

export function mockStatus(providerJobId: string, startedAt: string, now = Date.now()): ProviderStatus {
  const elapsed = now - Date.parse(startedAt);
  const jobId = providerJobId.replace(/^mock_/, "");
  if (!Number.isFinite(elapsed) || elapsed < MOCK_PENDING_MS) return { status: "pending" };
  if (elapsed < MOCK_DONE_MS) return { status: "running" };
  return { status: "done", resultUrl: `/api/jobs/${jobId}/result` };
}

export const mockProvider: VideoProvider = {
  name: "mock",
  supportedRenderTypes: RENDER_TYPES,
  async generate({ jobId }) {
    return { providerJobId: `mock_${jobId}` };
  },
  async getStatus(providerJobId, startedAt) {
    return mockStatus(providerJobId, startedAt);
  },
};
