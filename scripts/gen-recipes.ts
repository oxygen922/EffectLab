import { readFileSync, writeFileSync } from "fs";
import path from "path";
import type { RecipeFile, RecipeStep, Template, TemplateRecipe } from "../lib/types";

/**
 * Regenerates data/recipes.json: the generation toolbox plus one pipeline per template.
 *
 * Pipelines:
 * - direct     photo → image-to-video model, one pass.
 * - storyboard photo → reference/keyframe image → image-to-video.
 *
 * Curated recipes below are hand-written for well-known templates. Everything else
 * gets a category default marked "auto" so the library is complete but honest about
 * what still needs human review.
 */

const TOOLBOX: RecipeFile["tools"] = {
  "kling-2.1-i2v": {
    name: "Kling 2.1 (image-to-video)",
    kind: "image-to-video",
    provider: "gateway",
    notes: "Cheap-token channel. Animates a still with a motion prompt.",
  },
  "wan-2.5-i2v": {
    name: "Wan 2.5 (image-to-video)",
    kind: "image-to-video",
    provider: "gateway",
    notes: "Budget i2v alternative, good 9:16 compliance.",
  },
  "hailuo-02-i2v": {
    name: "Hailuo 02 (image-to-video)",
    kind: "image-to-video",
    provider: "gateway",
    notes: "Strong character motion for dance/rap templates.",
  },
  "qwen-image-edit": {
    name: "Qwen Image Edit",
    kind: "image-edit",
    provider: "gateway",
    notes: "Places the uploaded face/pet into a posed reference frame.",
  },
  "flux-1-dev-t2i": {
    name: "FLUX.1 dev (text-to-image)",
    kind: "text-to-image",
    provider: "gateway",
    notes: "Generates the styled keyframe when no user photo fits the scene.",
  },
};

type Curated = TemplateRecipe & { slug: string };

const CURATED: Curated[] = [
  {
    slug: "bicep-heart",
    pipeline: "storyboard",
    source: "curated",
    steps: [
      {
        tool: "qwen-image-edit",
        action: "pose reference",
        input: "user face photo + muscle pose prompt",
        output: "styled first frame (9:16)",
        params: { ratio: "9:16" },
      },
      {
        tool: "kling-2.1-i2v",
        action: "animate",
        input: "first frame + flex motion prompt",
        output: "5s clip",
        params: { duration: 5, ratio: "9:16" },
      },
    ],
    notes: "Face must land in the posed body first; direct i2v misses the gag.",
  },
  {
    slug: "24k-magic",
    pipeline: "storyboard",
    source: "curated",
    steps: [
      {
        tool: "qwen-image-edit",
        action: "outfit + stage reference",
        input: "2 user photos + stage outfit prompt",
        output: "stage look first frame",
        params: { ratio: "9:16" },
      },
      {
        tool: "hailuo-02-i2v",
        action: "animate",
        input: "first frame + dance motion prompt",
        output: "14s clip",
        params: { duration: 14, ratio: "9:16" },
      },
    ],
    notes: "Dance beat needs a strong motion model; stitch two clips for 14s.",
  },
  {
    slug: "kung-fu-cat",
    pipeline: "direct",
    source: "curated",
    steps: [
      {
        tool: "kling-2.1-i2v",
        action: "animate",
        input: "pet photo + kung-fu motion prompt",
        output: "9s clip",
        params: { duration: 9, ratio: "9:16" },
      },
    ],
    notes: "Pets animate straight from the photo; no reference frame needed.",
  },
  {
    slug: "studio-slate",
    pipeline: "direct",
    source: "curated",
    steps: [
      {
        tool: "wan-2.5-i2v",
        action: "animate",
        input: "user photo + studio intro motion prompt",
        output: "5s clip",
        params: { duration: 5, ratio: "9:16" },
      },
    ],
    notes: "House template. Cheapest model keeps the intro clip affordable.",
  },
];

const STORYBOARD_CATEGORIES = new Set(["dance", "rap", "car", "transform", "seasonal"]);

function directRecipe(template: Template): TemplateRecipe {
  const step: RecipeStep = {
    tool: "kling-2.1-i2v",
    action: "animate",
    input: `${template.photo_count === 1 ? "user photo" : `${template.photo_count} user photos`} + effect motion prompt`,
    output: `${template.duration_sec}s clip`,
    params: { duration: template.duration_sec, ratio: template.aspect_ratio },
  };
  return {
    pipeline: "direct",
    source: "auto",
    steps: [step],
    notes: "Auto draft: photo animates straight into video. Review before wiring a real model.",
  };
}

function storyboardRecipe(template: Template): TemplateRecipe {
  const steps: RecipeStep[] = [
    {
      tool: "qwen-image-edit",
      action: "reference frame",
      input: `${template.photo_count === 1 ? "user photo" : `${template.photo_count} user photos`} + scene/pose prompt`,
      output: "styled first frame",
      params: { ratio: template.aspect_ratio },
    },
    {
      tool: "hailuo-02-i2v",
      action: "animate",
      input: "first frame + motion prompt",
      output: `${template.duration_sec}s clip`,
      params: { duration: template.duration_sec, ratio: template.aspect_ratio },
    },
  ];
  return {
    pipeline: "storyboard",
    source: "auto",
    steps,
    notes: "Auto draft: build the keyframe first, then animate. Review before wiring a real model.",
  };
}

const catalog = JSON.parse(
  readFileSync(path.join(process.cwd(), "data", "templates.json"), "utf8"),
) as { templates: Template[] };

const recipes: RecipeFile["recipes"] = {};
for (const template of catalog.templates) {
  const curated = CURATED.find((item) => item.slug === template.slug);
  if (curated) {
    const { slug: _slug, ...recipe } = curated;
    recipes[template.slug] = recipe;
    continue;
  }
  const category = template.category?.toLowerCase() ?? "";
  recipes[template.slug] = STORYBOARD_CATEGORIES.has(category)
    ? storyboardRecipe(template)
    : directRecipe(template);
}

const output: RecipeFile = {
  schema_version: 1,
  generated_at: new Date().toISOString(),
  tools: TOOLBOX,
  recipes,
};

const outPath = path.join(process.cwd(), "data", "recipes.json");
writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);

const pipelines = Object.values(recipes).reduce<Record<string, number>>((acc, recipe) => {
  acc[recipe.pipeline] = (acc[recipe.pipeline] ?? 0) + 1;
  return acc;
}, {});
const curatedCount = Object.values(recipes).filter((recipe) => recipe.source === "curated").length;

console.log(
  `recipes.json written: ${Object.keys(recipes).length} templates · ${pipelines.direct ?? 0} direct · ${pipelines.storyboard ?? 0} storyboard · ${curatedCount} curated`,
);
