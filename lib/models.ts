import { findRecipe } from "./recipes";

export type ModelTier = "standard" | "pro" | "flagship";

export type ModelInfo = { name: string; tier: ModelTier; unitCost: number };

// Render pricing follows the model tier: fancier models burn more credits.
export const MODEL_CATALOG: Record<string, ModelInfo> = {
  "wan-2.5-i2v": { name: "Wan 2.5", tier: "standard", unitCost: 1 },
  "qwen-image-edit": { name: "Qwen Image Edit", tier: "standard", unitCost: 1 },
  "flux-1-dev-t2i": { name: "Flux 1 Dev", tier: "standard", unitCost: 1 },
  "kling-2.1-i2v": { name: "Kling 2.1", tier: "pro", unitCost: 2 },
  "hailuo-02-i2v": { name: "Hailuo 02", tier: "flagship", unitCost: 4 },
};

export const TIER_META: Record<ModelTier, { label: string; rate: string }> = {
  standard: { label: "Standard", rate: "1 credit / render" },
  pro: { label: "Pro", rate: "2 credits / render" },
  flagship: { label: "Flagship", rate: "4 credits / render" },
};

export function modelInfo(tool: string): ModelInfo {
  return MODEL_CATALOG[tool] ?? { name: tool, tier: "standard", unitCost: 1 };
}

export type RenderPlan = {
  tier: ModelTier | null;
  modelNames: string[];
  unitCost: number;
};

// A template renders at its most expensive tool's rate — storyboard recipes
// chain an image edit before the video pass, so the video model sets the price.
export function renderPlanForTemplate(slug: string, fallbackCost: number): RenderPlan {
  const recipe = findRecipe(slug);
  if (!recipe) {
    return { tier: null, modelNames: [], unitCost: Math.max(1, fallbackCost) };
  }
  const infos = recipe.steps.map((step) => modelInfo(step.tool));
  const top = infos.reduce((acc, cur) => (cur.unitCost > acc.unitCost ? cur : acc));
  return {
    tier: top.tier,
    modelNames: [...new Set(infos.map((info) => info.name))],
    unitCost: top.unitCost,
  };
}
