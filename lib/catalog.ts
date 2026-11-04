import { readFileSync } from "fs";
import path from "path";
import type { CatalogFile, Template } from "./types";

export function catalogPath(): string {
  return path.join(process.cwd(), "data", "templates.json");
}

export function loadCatalog(): CatalogFile {
  const parsed = JSON.parse(readFileSync(catalogPath(), "utf8")) as CatalogFile;
  return parsed;
}

export function loadTemplates(): Template[] {
  return loadCatalog().templates;
}

export function findTemplate(slug: string): Template | null {
  return loadTemplates().find((template) => template.slug === slug || template.id === slug) ?? null;
}
