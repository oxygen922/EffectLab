import { loadTemplates } from "@/lib/catalog";
import { errorResponse } from "@/lib/errors";
import type { Template } from "@/lib/types";

export const dynamic = "force-dynamic";

function matches(template: Template, query: string, category: string, featured: boolean): boolean {
  if (featured && !template.featured) return false;
  if (category && template.category !== category && !template.tags.includes(category)) return false;
  if (!query) return true;
  const haystack = [template.name, template.slug, template.category ?? "", ...template.tags, ...template.sites]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const category = (url.searchParams.get("category") ?? "").trim().toLowerCase();
    const featured = url.searchParams.get("featured") === "1";
    const templates = loadTemplates().filter((template) => matches(template, query, category, featured));
    return Response.json({ count: templates.length, templates });
  } catch (error) {
    return errorResponse(error);
  }
}
