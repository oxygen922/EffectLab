import { mockProvider } from "./mock";
import type { VideoProvider } from "./types";

export function getProvider(): VideoProvider {
  const name = process.env.VIDEO_PROVIDER || "mock";
  if (name !== "mock") {
    throw new Error(`VIDEO_PROVIDER=${name} is not implemented. Use mock.`);
  }
  return mockProvider;
}
