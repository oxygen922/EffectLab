import { readFileSync } from "fs";
import path from "path";
import { findTemplate } from "./catalog";
import type { GenerateInput } from "./providers/types";
import type { PromptFile, TemplatePrompt } from "./types";

/**
 * Generation prompts live in data/prompts.json, one record per template slug.
 * Recipe pipelines in data/recipes.json only name the tools; they do not
 * duplicate this text.
 */
const SHARED_SUFFIX = [
  "Keep the clip vertical 9:16.",
  "Preserve the reference identity exactly: same face, hair, clothing, and, for a pet, the same breed and markings.",
  "No warped limbs, extra fingers, face drift, on-screen text, logos, or watermarks.",
].join(" ");

export function promptsPath(): string {
  return path.join(process.cwd(), "data", "prompts.json");
}

let cache: PromptFile | null = null;

export function loadPrompts(): PromptFile {
  if (!cache) cache = JSON.parse(readFileSync(promptsPath(), "utf8")) as PromptFile;
  return cache;
}

export function findPrompt(slug: string): TemplatePrompt | null {
  return loadPrompts().prompts[slug] ?? null;
}

function genericFallback(subject: string): string {
  return [
    `Animate the reference photo(s) into the "${subject}" effect as one short vertical clip.`,
    "Keep the subject's face, outfit and colours consistent with the reference.",
    "Add subtle camera movement, natural lighting and a smooth, seamless motion.",
  ].join(" ");
}

/** Template prompt plus the shared identity and format suffix. Generic sentence only if the template has none. */
export function buildPrompt(input: GenerateInput): string {
  const template = findTemplate(input.templateKey);
  const slug = template?.slug ?? input.templateKey;
  const text = findPrompt(slug)?.prompt?.trim() ?? "";
  if (!text) {
    const subject = template?.name ?? input.templateKey;
    console.warn(`buildPrompt: template "${input.templateKey}" has no prompt; using the generic fallback.`);
    return genericFallback(subject);
  }
  return `${text} ${SHARED_SUFFIX}`;
}
