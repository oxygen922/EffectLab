import type { RenderType } from "../render-models";
import type { ProviderStatus, VideoProvider } from "./types";

type SkeletonOptions = {
  name: string;
  keyEnv: string;
  /** Wan accepts either fal or DashScope. Other providers use keyEnv only. */
  extraKeyEnv?: string;
  supportedRenderTypes: readonly RenderType[];
  detail: string;
};

function missingKey(options: SkeletonOptions): string {
  const keys = options.extraKeyEnv ? `${options.keyEnv} or ${options.extraKeyEnv}` : options.keyEnv;
  return `${keys} is not set. Add it to .env.local before using the ${options.name} provider. No request was sent.`;
}

/** Adapter that reserves a provider name and fails closed. It never calls the upstream API. */
export function skeletonProvider(options: SkeletonOptions): VideoProvider {
  return {
    name: options.name,
    supportedRenderTypes: options.supportedRenderTypes,
    async generate() {
      const ready = Boolean(process.env[options.keyEnv] || (options.extraKeyEnv && process.env[options.extraKeyEnv]));
      if (!ready) throw new Error(missingKey(options));
      throw new Error(
        `${options.name} adapter is a skeleton. ${options.detail} No request was sent.`,
      );
    },
    async getStatus(): Promise<ProviderStatus> {
      return {
        status: "failed",
        error: `${options.name} adapter is a skeleton and cannot poll a task. No request was sent.`,
      };
    },
  };
}

export const klingProvider = skeletonProvider({
  name: "kling",
  keyEnv: "KLING_API_KEY",
  supportedRenderTypes: ["motion_transfer", "face_swap", "image_to_video"],
  detail:
    "Motion transfer would POST https://api-singapore.klingai.com/motion-control/kling-3.0 and poll GET /tasks?task_ids=. Image-to-video and clip edit are separate Kling routes and are not wired.",
});

export const wanProvider = skeletonProvider({
  name: "wan",
  keyEnv: "FAL_KEY",
  extraKeyEnv: "DASHSCOPE_API_KEY",
  supportedRenderTypes: ["motion_transfer", "face_swap"],
  detail:
    "Face swap would queue fal-ai/wan/v2.2-14b/animate/replace or DashScope wan2.2-animate-mix. Motion transfer would call DashScope wan2.2-animate-move. Neither call is wired.",
});

export const pixverseProvider = skeletonProvider({
  name: "pixverse",
  keyEnv: "FAL_KEY",
  supportedRenderTypes: ["face_swap"],
  detail: "Face swap would queue fal-ai/pixverse/swap with the base video and a face image. That call is not wired.",
});

export const minimaxProvider = skeletonProvider({
  name: "minimax",
  keyEnv: "MINIMAX_API_KEY",
  supportedRenderTypes: ["image_to_video", "motion_transfer"],
  detail:
    "Image-to-video would POST https://api.minimax.io/v1/video_generation and poll GET /v1/query/video_generation. That call is not wired.",
});

export const veoProvider = skeletonProvider({
  name: "veo",
  keyEnv: "VEO_API_KEY",
  supportedRenderTypes: ["image_to_video"],
  detail: "Veo image-to-video is not wired.",
});

export const viggleProvider = skeletonProvider({
  name: "viggle",
  keyEnv: "VIGGLE_API_KEY",
  supportedRenderTypes: ["motion_transfer"],
  detail: "Motion transfer would POST /v1/renders on the Viggle API and poll the render. That call is not wired.",
});

export const viduProvider = skeletonProvider({
  name: "vidu",
  keyEnv: "VIDU_API_KEY",
  supportedRenderTypes: ["image_to_video", "motion_transfer"],
  detail:
    "Reference-to-video would POST https://api.vidu.com/ent/v2/reference2video and poll GET /ent/v2/tasks/{id}/creations. That call is not wired.",
});

export const runwayProvider = skeletonProvider({
  name: "runway",
  keyEnv: "RUNWAY_API_KEY",
  supportedRenderTypes: ["motion_transfer"],
  detail: "Act-Two would POST /v1/character_performance. That call is not wired.",
});
