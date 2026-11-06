import { existsSync, readFileSync } from "fs";
import path from "path";
import type { RecipeFile, TemplateRecipe } from "./types";

export function recipesPath(): string {
  return path.join(process.cwd(), "data", "recipes.json");
}

let cache: RecipeFile | null = null;

export function loadRecipes(): RecipeFile {
  if (!cache) cache = JSON.parse(readFileSync(recipesPath(), "utf8")) as RecipeFile;
  return cache;
}

export function findRecipe(slug: string): TemplateRecipe | null {
  return loadRecipes().recipes[slug] ?? null;
}
