"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { siteLabel, type Template } from "@/lib/types";

function photoLabel(count: number): string {
  return count === 1 ? "1 photo" : `${count} photos`;
}

function Card({ template }: { template: Template }) {
  return (
    <Link href={`/templates/${template.slug}`} className="card">
      <img className="cover" src={template.cover} alt="" />
      <div className="card-body">
        <h3>{template.name}</h3>
        <div className="meta">
          <span className="tag hot">{template.credit_cost} cr</span>
          <span className="tag">{photoLabel(template.photo_count)}</span>
          <span className="tag">{template.duration_sec}s</span>
          {template.cross_count > 0 ? <span className="tag">{template.cross_count} catalogs</span> : <span className="tag">original</span>}
        </div>
      </div>
    </Link>
  );
}

export function Catalog({ templates }: { templates: Template[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState<"priority" | "new" | "photos">("priority");

  const categories = useMemo(
    () => [...new Set(templates.map((template) => template.category).filter((value): value is string => Boolean(value)))].sort(),
    [templates],
  );
  const featured = templates.filter((template) => template.featured);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = templates.filter((template) => {
      if (filter === "featured" && !template.featured) return false;
      if (filter.startsWith("category:") && template.category !== filter.slice(9)) return false;
      if (filter.startsWith("tag:") && !template.tags.includes(filter.slice(4))) return false;
      if (!q) return true;
      return [template.name, template.slug, template.category ?? "", ...template.tags, ...template.sites.map(siteLabel)]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
    return rows.slice().sort((a, b) => {
      if (sort === "photos") return b.photo_count - a.photo_count || a.name.localeCompare(b.name);
      if (sort === "new") return (b.first_seen ?? "").localeCompare(a.first_seen ?? "") || b.priority - a.priority;
      return b.priority - a.priority || b.cross_count - a.cross_count || a.name.localeCompare(b.name);
    });
  }, [templates, query, filter, sort]);

  const showFeatured = filter === "all" && query.trim() === "";

  return (
    <div>
      {showFeatured ? (
        <section>
          <div className="section-head">
            <h2>Followed this week</h2>
            <span className="muted">{featured.length} pinned from the public catalogs</span>
          </div>
          <div className="feature-row">
            {featured.map((template) => (
              <Card key={template.slug} template={template} />
            ))}
          </div>
        </section>
      ) : null}

      <div className="filters">
        <input
          aria-label="Search templates"
          placeholder="Search name or tag"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select aria-label="Filter templates" value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="all">All templates</option>
          <option value="featured">Featured</option>
          {categories.map((category) => (
            <option key={category} value={`category:${category}`}>
              {category}
            </option>
          ))}
          <option value="tag:new">New</option>
          <option value="tag:music">Music</option>
        </select>
        <select aria-label="Sort templates" value={sort} onChange={(event) => setSort(event.target.value as "priority" | "new" | "photos")}>
          <option value="priority">Sort by heat</option>
          <option value="new">Sort by first seen</option>
          <option value="photos">Sort by photo count</option>
        </select>
      </div>

      <div className="section-head">
        <h2>Catalog</h2>
        <span className="muted">{visible.length} templates</span>
      </div>
      {visible.length === 0 ? <p className="muted">No templates match that filter.</p> : null}
      <div className="grid">
        {visible.map((template) => (
          <Card key={template.slug} template={template} />
        ))}
      </div>
    </div>
  );
}
