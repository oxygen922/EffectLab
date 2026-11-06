import { NextResponse } from "next/server";
import { loadRecipes } from "@/lib/recipes";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const recipe = loadRecipes().recipes[slug];
  if (!recipe) return NextResponse.json({ error: "Recipe not found", code: "not_found" }, { status: 404 });
  return NextResponse.json({ slug, ...recipe });
}
