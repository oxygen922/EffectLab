import assert from "node:assert/strict";
import test from "node:test";
import { loadTemplates } from "../lib/catalog";
import { renderPlanForTemplate } from "../lib/models";
import { MODEL_REGISTRY, type RenderType } from "../lib/render-models";
import { loadRenderTypes } from "../lib/render-types";
import { mockProvider } from "../lib/providers/mock";
import { selectRoute } from "../lib/providers/router";

test("every template has a render type and a compatible suggested model", () => {
  const file = loadRenderTypes();
  const templates = loadTemplates();
  assert.equal(Object.keys(file.templates).length, templates.length);
  const counts: Record<RenderType, number> = { motion_transfer: 0, face_swap: 0, image_to_video: 0 };
  const sources = { source_page: 0, inferred: 0 };
  for (const template of templates) {
    const record = file.templates[template.slug];
    assert.ok(record, template.slug);
    assert.ok(record.reason.trim().length > 0, template.slug);
    assert.equal(record.referenceVideo, null, template.slug);
    assert.equal(record.baseVideo, null, template.slug);
    const model = MODEL_REGISTRY[record.suggestedModel];
    assert.ok(model, `${template.slug} model ${record.suggestedModel}`);
    assert.equal(model.renderTypes.includes(record.renderType), true, `${template.slug} ${record.suggestedModel}`);
    assert.ok(record.alternates.length >= 1 && record.alternates.length <= 2, template.slug);
    for (const alt of record.alternates) {
      const alternate = MODEL_REGISTRY[alt];
      assert.ok(alternate, `${template.slug} alternate ${alt}`);
      assert.equal(alternate.renderTypes.includes(record.renderType), true, `${template.slug} ${alt}`);
    }
    assert.equal(record.modelSource === "source_page" || record.modelSource === "inferred", true);
    if (record.modelSource === "source_page") assert.ok(record.citations.length > 0, template.slug);
    counts[record.renderType] += 1;
    sources[record.modelSource] += 1;
  }
  assert.equal(counts.motion_transfer + counts.face_swap + counts.image_to_video, templates.length);
  assert.equal(sources.source_page + sources.inferred, templates.length);
  assert.equal(mockProvider.supportedRenderTypes.length, 3);
});

test("router uses the suggested model when that provider is configured", () => {
  const route = selectRoute(
    "car-alarm",
    { VIDEO_PROVIDER: "router", SAILF_API_KEY: "test", KLING_API_KEY: "test" },
    "/tmp/reference.mp4",
  );
  assert.equal(route.providerName, "sailf");
  assert.equal(route.modelId, "seedance-2.5");
  assert.equal(route.renderType, "motion_transfer");
  assert.equal(route.assetPath, "/tmp/reference.mp4");
  assert.deepEqual(route.warnings, []);
});

test("router follows alternates when the suggested provider is unset", () => {
  const route = selectRoute("car-alarm", { VIDEO_PROVIDER: "router", KLING_API_KEY: "test" }, "/tmp/reference.mp4");
  assert.equal(route.providerName, "kling");
  assert.equal(route.modelId, "kling-3.0-motion-control");
  assert.equal(route.renderType, "motion_transfer");
  assert.equal(
    route.warnings.some((warning) => warning.includes("not configured")),
    true,
  );
});

test("provider chain reaches sailf when the motion providers are unset", () => {
  const route = selectRoute("popstar", { VIDEO_PROVIDER: "router", SAILF_API_KEY: "test" }, "/tmp/reference.mp4");
  assert.equal(route.requestedRenderType, "motion_transfer");
  assert.equal(route.renderType, "motion_transfer");
  assert.equal(route.providerName, "sailf");
  assert.equal(route.modelId, "seedance-2.0-mini");
  assert.equal(
    route.warnings.some((warning) => warning.includes("provider chain")),
    true,
  );
});

test("a motion template with no reference video falls back to image-to-video", () => {
  const route = selectRoute(
    "car-alarm",
    { VIDEO_PROVIDER: "router", SAILF_API_KEY: "test", KLING_API_KEY: "test" },
    null,
  );
  assert.equal(route.requestedRenderType, "motion_transfer");
  assert.equal(route.renderType, "image_to_video");
  assert.equal(route.providerName, "sailf");
  assert.equal(route.modelId, "seedance-2.5");
  assert.equal(route.assetPath, null);
  assert.equal(
    route.warnings.some((warning) => warning.includes("no reference video") && warning.includes("image_to_video")),
    true,
  );
});

test("a face-swap template with no base video falls back to image-to-video", () => {
  const route = selectRoute("birthday-car", { VIDEO_PROVIDER: "router", SAILF_API_KEY: "test" }, null);
  assert.equal(route.requestedRenderType, "face_swap");
  assert.equal(route.renderType, "image_to_video");
  assert.equal(route.providerName, "sailf");
});

test("with no keys, motion falls through to image-to-video and names Sailf", () => {
  const route = selectRoute("popstar", { VIDEO_PROVIDER: "router" }, "/tmp/reference.mp4");
  assert.equal(route.renderType, "image_to_video");
  assert.equal(route.providerName, "sailf");
  assert.equal(route.modelId, "seedance-2.0-mini");
  assert.equal(
    route.warnings.some((warning) => warning.includes("falling back to image_to_video")),
    true,
  );
});

test("mock runs every type without upstream keys", () => {
  const route = selectRoute("car-alarm", { VIDEO_PROVIDER: "mock" }, null);
  assert.equal(route.providerName, "mock");
  assert.equal(route.renderType, "image_to_video");
  assert.equal(route.requestedRenderType, "motion_transfer");
});

test("suggested model price replaces the recipe tier", () => {
  assert.equal(renderPlanForTemplate("studio-slate", 1).unitCost, 1);
  assert.equal(renderPlanForTemplate("studio-slate", 1).tier, "standard");
  const dance = renderPlanForTemplate("car-alarm", 1);
  assert.equal(dance.unitCost, 4);
  assert.equal(dance.tier, "flagship");
  assert.deepEqual(dance.modelNames, ["Seedance 2.5"]);
});
