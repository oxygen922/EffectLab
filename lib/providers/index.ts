import { mockProvider } from "./mock";
import { sub2apiProvider } from "./sub2api";
import type { VideoProvider } from "./types";

const PROVIDERS: Record<string, VideoProvider> = {
  mock: mockProvider,
  sub2api: sub2apiProvider,
};

export function getProvider(): VideoProvider {
  const name = process.env.VIDEO_PROVIDER || "mock";
  const provider = PROVIDERS[name];
  if (!provider) {
    throw new Error(`VIDEO_PROVIDER=${name} is not implemented. Use mock or sub2api.`);
  }
  return provider;
}
