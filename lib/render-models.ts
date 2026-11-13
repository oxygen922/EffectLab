/** Credit tier. Same three steps as lib/models.ts, defined here so the registry does not import that module. */
export type SuggestedTier = "standard" | "pro" | "flagship";

/** How a template is rendered. One pipeline per effect, not one generic image-plus-prompt path. */
export type RenderType = "motion_transfer" | "face_swap" | "image_to_video";

export const RENDER_TYPES: readonly RenderType[] = ["motion_transfer", "face_swap", "image_to_video"];

export const RENDER_TYPE_LABEL: Record<RenderType, string> = {
  motion_transfer: "Motion transfer",
  face_swap: "Face swap",
  image_to_video: "Image to video",
};

export type RenderModel = {
  /** Stable id stored on the template and the job. */
  id: string;
  label: string;
  /** Adapter name. Matches VideoProvider.name and the RENDER_PROVIDER_* chain. */
  provider: string;
  renderTypes: readonly RenderType[];
  tier: SuggestedTier;
  unitCost: number;
};

/**
 * Models the router can select. Capabilities are what the public API can take
 * for that effect, not every marketing feature of the vendor.
 * Seedance entries accept a reference video on Sailf's reference mode, which
 * is how source sites recreate a clip. That is not Kling's motion-control API
 * and not a dedicated face-swap API. See docs/render-types.md.
 */
export const MODEL_REGISTRY: Record<string, RenderModel> = {
  "seedance-2.5": {
    id: "seedance-2.5",
    label: "Seedance 2.5",
    provider: "sailf",
    renderTypes: ["image_to_video", "motion_transfer", "face_swap"],
    tier: "flagship",
    unitCost: 4,
  },
  "seedance-2.0": {
    id: "seedance-2.0",
    label: "Seedance 2.0",
    provider: "sailf",
    renderTypes: ["image_to_video", "motion_transfer", "face_swap"],
    tier: "flagship",
    unitCost: 4,
  },
  "seedance-2.0-mini": {
    id: "seedance-2.0-mini",
    label: "Seedance 2.0 Mini",
    provider: "sailf",
    renderTypes: ["image_to_video", "motion_transfer", "face_swap"],
    tier: "standard",
    unitCost: 1,
  },
  "kling-3.0": {
    id: "kling-3.0",
    label: "Kling 3.0",
    provider: "kling",
    renderTypes: ["image_to_video", "motion_transfer"],
    tier: "pro",
    unitCost: 2,
  },
  "kling-3.0-motion-control": {
    id: "kling-3.0-motion-control",
    label: "Kling 3.0 Motion Control",
    provider: "kling",
    renderTypes: ["motion_transfer"],
    tier: "flagship",
    unitCost: 4,
  },
  "kling-o3": {
    id: "kling-o3",
    label: "Kling O3",
    provider: "kling",
    renderTypes: ["image_to_video", "face_swap", "motion_transfer"],
    tier: "flagship",
    unitCost: 4,
  },
  "kling-4.0": {
    id: "kling-4.0",
    label: "Kling 4.0",
    provider: "kling",
    renderTypes: ["image_to_video", "face_swap", "motion_transfer"],
    tier: "flagship",
    unitCost: 4,
  },
  "hailuo-02": {
    id: "hailuo-02",
    label: "Hailuo 02",
    provider: "minimax",
    renderTypes: ["image_to_video"],
    tier: "standard",
    unitCost: 1,
  },
  "minimax-h3": {
    id: "minimax-h3",
    label: "MiniMax H3",
    provider: "minimax",
    renderTypes: ["image_to_video", "motion_transfer"],
    tier: "pro",
    unitCost: 2,
  },
  "veo-3.1": {
    id: "veo-3.1",
    label: "Veo 3.1",
    provider: "veo",
    renderTypes: ["image_to_video"],
    tier: "flagship",
    unitCost: 4,
  },
  "wan-2.2-animate-mix": {
    id: "wan-2.2-animate-mix",
    label: "Wan 2.2 Animate Mix",
    provider: "wan",
    renderTypes: ["face_swap"],
    tier: "pro",
    unitCost: 2,
  },
  "wan-2.2-animate-move": {
    id: "wan-2.2-animate-move",
    label: "Wan 2.2 Animate Move",
    provider: "wan",
    renderTypes: ["motion_transfer"],
    tier: "pro",
    unitCost: 2,
  },
  "pixverse-swap": {
    id: "pixverse-swap",
    label: "PixVerse Swap",
    provider: "pixverse",
    renderTypes: ["face_swap"],
    tier: "standard",
    unitCost: 1,
  },
  "viggle-remix": {
    id: "viggle-remix",
    label: "Viggle Remix",
    provider: "viggle",
    renderTypes: ["motion_transfer"],
    tier: "standard",
    unitCost: 1,
  },
  "vidu-q2-pro": {
    id: "vidu-q2-pro",
    label: "Vidu Q2 Pro",
    provider: "vidu",
    renderTypes: ["image_to_video", "motion_transfer"],
    tier: "pro",
    unitCost: 2,
  },
  "runway-act-two": {
    id: "runway-act-two",
    label: "Runway Act-Two",
    provider: "runway",
    renderTypes: ["motion_transfer"],
    tier: "pro",
    unitCost: 2,
  },
};

export function modelById(id: string): RenderModel | null {
  return MODEL_REGISTRY[id] ?? null;
}

/** Env var that must be set before the adapter will be selected. */
export function providerKeyEnv(provider: string): string | null {
  switch (provider) {
    case "sailf":
      return "SAILF_API_KEY";
    case "kling":
      return "KLING_API_KEY";
    case "wan":
      return "FAL_KEY";
    case "pixverse":
      return "FAL_KEY";
    case "minimax":
      return "MINIMAX_API_KEY";
    case "veo":
      return "VEO_API_KEY";
    case "viggle":
      return "VIGGLE_API_KEY";
    case "vidu":
      return "VIDU_API_KEY";
    case "runway":
      return "RUNWAY_API_KEY";
    case "sub2api":
      return "SUB2API_API_KEY";
    case "mock":
      return null;
    default:
      return null;
  }
}

export function providerConfigured(provider: string, env: NodeJS.ProcessEnv): boolean {
  if (provider === "mock") return true;
  // Wan character-replace is hosted on fal. The DashScope move/mix APIs use a separate key.
  // Either key opts the wan adapter in; the skeleton still refuses to submit.
  if (provider === "wan") return Boolean(env.FAL_KEY || env.DASHSCOPE_API_KEY);
  const key = providerKeyEnv(provider);
  if (!key) return false;
  return Boolean(env[key]);
}

export const DEFAULT_PROVIDER_CHAIN: Record<RenderType, readonly string[]> = {
  motion_transfer: ["kling", "wan", "viggle", "sailf"],
  face_swap: ["wan", "pixverse", "kling", "sailf"],
  image_to_video: ["sailf", "minimax", "kling"],
};

/** Model used when the chain names a provider rather than a model id. */
export function defaultModelFor(provider: string, renderType: RenderType): string | null {
  const table: Record<string, Partial<Record<RenderType, string>>> = {
    sailf: {
      motion_transfer: "seedance-2.0-mini",
      face_swap: "seedance-2.0-mini",
      image_to_video: "seedance-2.0-mini",
    },
    kling: {
      motion_transfer: "kling-3.0-motion-control",
      face_swap: "kling-o3",
      image_to_video: "kling-3.0",
    },
    wan: {
      motion_transfer: "wan-2.2-animate-move",
      face_swap: "wan-2.2-animate-mix",
    },
    pixverse: { face_swap: "pixverse-swap" },
    minimax: { image_to_video: "hailuo-02", motion_transfer: "minimax-h3" },
    viggle: { motion_transfer: "viggle-remix" },
    vidu: { image_to_video: "vidu-q2-pro", motion_transfer: "vidu-q2-pro" },
    runway: { motion_transfer: "runway-act-two" },
    veo: { image_to_video: "veo-3.1" },
  };
  return table[provider]?.[renderType] ?? null;
}
