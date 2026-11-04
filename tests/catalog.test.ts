import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildCatalog, FORBIDDEN_KEY, stripForbidden } from "../lib/import/build-catalog";
import { coverSvg } from "../lib/covers";
import type { CatalogFile, RadarFile, Template } from "../lib/types";

const FEATURED = [
  "tiny-desk",
  "kung-fu-cat",
  "ozil-goal",
  "birds-of-a-feather",
  "ceiling-fan-elevator-outfits",
  "cardo-dinner",
  "phone-on-the-train",
  "closing-door-prank",
  "flamingo-float",
  "dog-bartender",
];

test("import drops media fields, keeps manual rows, and lets editorial win", () => {
  const radar: RadarFile = {
    scraped_at: "2026-11-04T12:30:00+08:00",
    templates: [
      {
        name: "Tiny Desk",
        name_norm: "tiny desk",
        source_site: "vidlark",
        source_url: "https://vidlark.ai/effects/tiny-desk-concert-ai",
        photos_required: 5,
        duration_sec: 15,
        listed_at: "2026-10-27",
        cross_sites: ["vidlark", "viralvideoai"],
        tags: ["week_page"],
        preview_poster_url: "https://cdn.example/tiny.mp4",
        prompt: "do not keep this",
      },
      {
        name: "Tiny Desk",
        name_norm: "tiny desk",
        source_site: "makeviral",
        photos_required: 1,
        duration_sec: 10,
        cross_sites: ["makeviral", "starrd"],
        tags: ["music"],
      },
    ],
  };
  const existing: CatalogFile = {
    schema_version: 1,
    generated_at: "2026-11-01T00:00:00.000Z",
    source: "template-radar/latest/templates.json",
    source_scraped_at: null,
    template_count: 1,
    note: "prior",
    templates: [
      {
        id: "hand-card",
        name: "Hand Card",
        slug: "hand-card",
        sites: [],
        photo_count: 2,
        duration_sec: 6,
        tags: ["original"],
        category: "lab",
        aspect_ratio: "9:16",
        first_seen: null,
        cross_count: 0,
        priority: 2,
        credit_cost: 3,
        blurb: "Kept by hand",
        featured: false,
        origin: "manual",
        cover: "/covers/hand-card",
      },
    ],
  };
  const catalog = buildCatalog(radar, existing, {
    "tiny-desk": { featured: true, credit_cost: 2, blurb: "Desk card" },
    "secret-clip": { hidden: true, name: "Secret", blurb: "https://cdn.example/a.mp4" },
    "studio-slate": { origin: "manual", name: "Studio Slate", photo_count: 1 },
  });
  const tiny = catalog.templates.find((template) => template.slug === "tiny-desk");
  assert.ok(tiny);
  assert.equal(tiny.photo_count, 5);
  assert.equal(tiny.credit_cost, 2);
  assert.equal(tiny.featured, true);
  assert.equal(tiny.blurb, "Desk card");
  assert.deepEqual(tiny.sites, ["makeviral", "starrd", "vidlark", "viralvideoai"]);
  assert.equal(JSON.stringify(tiny).includes("mp4"), false);
  assert.equal(JSON.stringify(tiny).includes("prompt"), false);
  assert.equal(catalog.templates.some((template) => template.slug === "secret-clip"), false);
  assert.equal(catalog.templates.some((template) => template.slug === "hand-card"), true);
  assert.equal(catalog.templates.find((template) => template.slug === "studio-slate")?.origin, "manual");
  for (const template of catalog.templates) {
    for (const key of Object.keys(template)) assert.equal(FORBIDDEN_KEY.test(key), false);
    assert.equal(template.cover, `/covers/${template.slug}`);
  }
});

test("stripForbidden removes poster and prompt keys", () => {
  const cleaned = stripForbidden({ name: "Ok", prompt: "x", preview_poster_url: "y" });
  assert.deepEqual(cleaned, { name: "Ok" });
});

test("covers are original svg without remote assets", () => {
  const svg = coverSvg("kung-fu-cat", "Kung Fu Cat");
  assert.match(svg, /<svg/);
  assert.match(svg, /EFFECTLAB/);
  assert.equal(/https?:\/\/(?!www\.w3\.org\/)/i.test(svg), false);
  assert.equal(svg.includes(".mp4"), false);
});

test("shipped catalog matches the radar import rules", () => {
  const radar = JSON.parse(readFileSync("template-radar/latest/templates.json", "utf8")) as RadarFile;
  const editorial = JSON.parse(readFileSync("data/editorial.json", "utf8"));
  const shipped = JSON.parse(readFileSync("data/templates.json", "utf8")) as CatalogFile;
  const rebuilt = buildCatalog(radar, null, editorial, shipped.generated_at);
  assert.equal(rebuilt.template_count, shipped.template_count);
  assert.deepEqual(
    rebuilt.templates.map((template: Template) => template.slug),
    shipped.templates.map((template) => template.slug),
  );
  for (const slug of FEATURED) {
    const template = shipped.templates.find((item) => item.slug === slug);
    assert.ok(template, slug);
    assert.equal(template.featured, true);
  }
  const flamingo = shipped.templates.find((template) => template.slug === "flamingo-float");
  assert.equal(flamingo?.name, "Flamingo Float");
  assert.equal(flamingo?.duration_sec, 12);
  assert.equal(flamingo?.origin, "radar");
  const tiny = shipped.templates.find((template) => template.slug === "tiny-desk");
  assert.equal(tiny?.name, "Tiny Desk");
  assert.equal(tiny?.photo_count, 5);
  const manual = shipped.templates.find((template) => template.slug === "studio-slate");
  assert.equal(manual?.origin, "manual");
  const serialized = JSON.stringify(shipped.templates);
  assert.equal(/\.(mp4|webm|mov|m3u8)/i.test(serialized), false);
  assert.equal(serialized.includes("preview_poster_url"), false);
  assert.equal(serialized.includes("\"prompt\""), false);
});
