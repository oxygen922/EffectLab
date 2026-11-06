import { NextResponse } from "next/server";
import { loadRecipes } from "@/lib/recipes";

export const dynamic = "force-dynamic";

export async function GET() {
  const file = loadRecipes();
  const pipelines = Object.values(file.recipes).reduce<Record<string, number>>((acc, recipe) => {
    acc[recipe.pipeline] = (acc[recipe.pipeline] ?? 0) + 1;
    return acc;
  }, {});
  const curated = Object.values(file.recipes).filter((recipe) => recipe.source === "curated").length;
  return NextResponse.json({
    ...file,
    stats: { templates: Object.keys(file.recipes).length, pipelines, curated },
  });
}
