import { mockProvider } from "./mock";
import { sailfProvider } from "./sailf";
import {
  klingProvider,
  minimaxProvider,
  pixverseProvider,
  runwayProvider,
  veoProvider,
  viduProvider,
  viggleProvider,
  wanProvider,
} from "./skeletons";
import { sub2apiProvider } from "./sub2api";
import type { VideoProvider } from "./types";

const PROVIDERS: Record<string, VideoProvider> = {
  mock: mockProvider,
  sailf: sailfProvider,
  sub2api: sub2apiProvider,
  kling: klingProvider,
  wan: wanProvider,
  pixverse: pixverseProvider,
  minimax: minimaxProvider,
  veo: veoProvider,
  viggle: viggleProvider,
  vidu: viduProvider,
  runway: runwayProvider,
};

export function getProviderByName(name: string): VideoProvider {
  const provider = PROVIDERS[name];
  if (!provider) {
    throw new Error(
      `Provider "${name}" is not implemented. Use mock, sailf, sub2api, kling, wan, pixverse, minimax, veo, viggle, vidu, or runway.`,
    );
  }
  return provider;
}

/** Named adapter. Per-template selection lives in selectRoute. */
export function getProvider(): VideoProvider {
  const name = process.env.VIDEO_PROVIDER || "mock";
  if (name === "router") {
    throw new Error("VIDEO_PROVIDER=router selects a provider per template via selectRoute().");
  }
  return getProviderByName(name);
}
