import type { Metadata } from "next";
import { Catalog } from "@/components/Catalog";
import { loadCatalog } from "@/lib/catalog";
import { renderPlanForTemplate } from "@/lib/models";

export const metadata: Metadata = { title: "All templates · EffectLab" };

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string; sort?: string }>;
}) {
  const { category, q, sort } = await searchParams;
  const catalog = loadCatalog();
  const templates = catalog.templates.map((template) => ({
    ...template,
    sites: [],
    credit_cost: renderPlanForTemplate(template.slug, template.credit_cost).unitCost,
  }));
  const initialSort = sort === "new" || sort === "photos" ? sort : "priority";

  return (
    <main className="wrap">
      <section className="hero slim">
        <div>
          <p className="kicker">Template catalog</p>
          <h1>Pick a trend to recreate</h1>
          <p className="lede">
            {catalog.template_count} effects, each one rendered with your own photos. Filter by
            category or tag, search by name, and hover a card to preview the clip.
          </p>
        </div>
      </section>
      <Catalog
        templates={templates}
        initialCategory={category}
        initialQuery={q ?? ""}
        initialSort={initialSort}
      />
    </main>
  );
}
