import { mockProvider } from "./mock";
import { sailfProvider } from "./sailf";
import { sub2apiProvider } from "./sub2api";
import type { VideoProvider } from "./types";

const PROVIDERS: Record<string, VideoProvider> = {
  mock: mockProvider,
  sailf: sailfProvider,
  sub2api: sub2apiProvider,
};

export function getProvider(): VideoProvider {
  const name = process.env.VIDEO_PROVIDER || "mock";
  const provider = PROVIDERS[name];
  if (!provider) {
    throw new Error(`VIDEO_PROVIDER=${name} is not implemented. Use mock, sailf or sub2api.`);
  }
  return provider;
}
