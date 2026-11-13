import { findAssetFile, requireRenderRecord, type RenderRecord } from "../render-types";
import {
  DEFAULT_PROVIDER_CHAIN,
  MODEL_REGISTRY,
  defaultModelFor,
  providerConfigured,
  type RenderType,
} from "../render-models";

export type RouteEnv = NodeJS.ProcessEnv;

export type RouteDecision = {
  providerName: string;
  modelId: string;
  renderType: RenderType;
  requestedRenderType: RenderType;
  /** Absolute path of the reference or base video when the effective type still needs one. */
  assetPath: string | null;
  warnings: string[];
};

function chainFor(renderType: RenderType, env: RouteEnv): string[] {
  const raw = env[`RENDER_PROVIDER_${renderType.toUpperCase()}`];
  const source = raw && raw.trim() ? raw : DEFAULT_PROVIDER_CHAIN[renderType].join(",");
  return source
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function supports(modelId: string, renderType: RenderType): boolean {
  const model = MODEL_REGISTRY[modelId];
  return Boolean(model && model.renderTypes.includes(renderType));
}

function firstCompatible(ids: string[], renderType: RenderType): string | null {
  for (const id of ids) {
    if (supports(id, renderType)) return id;
  }
  return null;
}

/**
 * Pick a provider and model for one template.
 * Suggested model wins when its provider is configured and the model supports
 * the effective type. Then alternates, then the RENDER_PROVIDER_* chain, then
 * image-to-video. VIDEO_PROVIDER=mock and VIDEO_PROVIDER=sub2api run every
 * type on that adapter and do not require upstream keys.
 */
export function selectRoute(
  slug: string,
  env: RouteEnv = process.env,
  assetPathOverride?: string | null,
): RouteDecision {
  const record = requireRenderRecord(slug);
  const requestedRenderType = record.renderType;
  const warnings: string[] = [];
  let renderType: RenderType = requestedRenderType;

  const needsFile = requestedRenderType === "motion_transfer" || requestedRenderType === "face_swap";
  const kind = requestedRenderType === "face_swap" ? "base" : "reference";
  let assetPath: string | null = needsFile
    ? assetPathOverride !== undefined
      ? assetPathOverride
      : findAssetFile(slug, kind)
    : null;

  if (needsFile && !assetPath) {
    warnings.push(
      `template "${slug}" is ${requestedRenderType} but has no ${kind} video; falling back to image_to_video`,
    );
    renderType = "image_to_video";
  }

  const forced = env.VIDEO_PROVIDER || "mock";
  if (forced === "mock" || forced === "sub2api") {
    const modelId = firstCompatible([record.suggestedModel, ...record.alternates], renderType) ?? "seedance-2.0-mini";
    if (modelId !== record.suggestedModel) {
      warnings.push(
        `template "${slug}" suggested ${record.suggestedModel}, which does not support ${renderType}; recording ${modelId}`,
      );
    }
    return {
      providerName: forced,
      modelId,
      renderType,
      requestedRenderType,
      assetPath: renderType === "image_to_video" ? null : assetPath,
      warnings,
    };
  }

  const chosen = chooseModel(slug, record, renderType, env, warnings, true);
  renderType = chosen.renderType;
  if (renderType === "image_to_video") assetPath = null;

  const model = MODEL_REGISTRY[chosen.modelId];
  return {
    providerName: model?.provider ?? "sailf",
    modelId: chosen.modelId,
    renderType,
    requestedRenderType,
    assetPath,
    warnings,
  };
}

function chooseModel(
  slug: string,
  record: RenderRecord,
  renderType: RenderType,
  env: RouteEnv,
  warnings: string[],
  announce: boolean,
): { modelId: string; renderType: RenderType } {
  const usable = (modelId: string): boolean => {
    const model = MODEL_REGISTRY[modelId];
    if (!model || !model.renderTypes.includes(renderType)) return false;
    return providerConfigured(model.provider, env);
  };

  if (usable(record.suggestedModel)) return { modelId: record.suggestedModel, renderType };

  if (announce) {
    const suggested = MODEL_REGISTRY[record.suggestedModel];
    if (suggested && !suggested.renderTypes.includes(renderType)) {
      warnings.push(
        `template "${slug}" suggests ${record.suggestedModel}, which does not support ${renderType}; trying alternates`,
      );
    } else if (suggested && !providerConfigured(suggested.provider, env)) {
      warnings.push(
        `template "${slug}" suggests ${record.suggestedModel} (${suggested.provider}) but that provider is not configured; trying alternates`,
      );
    }
  }

  for (const alternate of record.alternates) {
    if (!usable(alternate)) continue;
    warnings.push(`template "${slug}" using alternate model ${alternate} for ${renderType}`);
    return { modelId: alternate, renderType };
  }

  for (const providerName of chainFor(renderType, env)) {
    const modelId = defaultModelFor(providerName, renderType);
    if (!modelId || !supports(modelId, renderType)) continue;
    if (!providerConfigured(providerName, env)) continue;
    warnings.push(`template "${slug}" using ${providerName} from the ${renderType} provider chain`);
    return { modelId, renderType };
  }

  if (renderType !== "image_to_video") {
    warnings.push(`template "${slug}" has no configured ${renderType} provider; falling back to image_to_video`);
    return chooseModel(slug, record, "image_to_video", env, warnings, false);
  }

  warnings.push(
    `template "${slug}" has no configured image-to-video provider; Sailf will be asked and will fail until SAILF_API_KEY is set`,
  );
  return { modelId: "seedance-2.0-mini", renderType: "image_to_video" };
}
