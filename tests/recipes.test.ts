import assert from "node:assert/strict";
import { readFileSync } from "fs";
import test from "node:test";
import type { CatalogFile, RecipeFile } from "../lib/types";

const recipes = JSON.parse(readFileSync("data/recipes.json", "utf8")) as RecipeFile;
const catalog = JSON.parse(readFileSync("data/templates.json", "utf8")) as CatalogFile;

test("every template has a recipe", () => {
  for (const template of catalog.templates) {
    assert.ok(recipes.recipes[template.slug], `missing recipe for ${template.slug}`);
  }
});

test("recipes reference registered tools only", () => {
  for (const [slug, recipe] of Object.entries(recipes.recipes)) {
    assert.ok(recipe.pipeline === "direct" || recipe.pipeline === "storyboard", slug);
    const minSteps = recipe.pipeline === "direct" ? 1 : 2;
    assert.ok(recipe.steps.length >= minSteps, `${slug}: ${recipe.pipeline} needs >= ${minSteps} steps`);
    for (const step of recipe.steps) {
      assert.ok(recipes.tools[step.tool], `${slug}: unknown tool ${step.tool}`);
      assert.ok(step.input && step.output, `${slug}: step needs input and output`);
    }
  }
});

test("toolbox covers the full generation chain", () => {
  const kinds = new Set(Object.values(recipes.tools).map((tool) => tool.kind));
  assert.ok(kinds.has("image-to-video"));
  assert.ok(kinds.has("image-edit"));
});

test("curated recipes exist and are well-formed", () => {
  const curated = Object.values(recipes.recipes).filter((recipe) => recipe.source === "curated");
  assert.ok(curated.length >= 4);
  for (const recipe of curated) {
    assert.ok(recipe.notes, "curated recipes carry review notes");
  }
});
