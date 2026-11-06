"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import type { Template } from "@/lib/types";

function photoLabel(count: number): string {
  return count === 1 ? "1 photo" : `${count} photos`;
}

export function Card({ template }: { template: Template }) {
  const poster = template.preview_poster_url;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  return (
    <Link href={`/templates/${template.slug}`} className="card">
      <div
        className="thumb"
        onMouseEnter={() => {
          void videoRef.current?.play().catch(() => undefined);
        }}
        onMouseLeave={() => {
          videoRef.current?.pause();
        }}
      >
        <img className="cover" src={poster ?? template.cover} alt="" loading="lazy" decoding="async" />
        {template.video_url ? (
          <video
            ref={videoRef}
            className="cover-video"
            src={template.video_url}
            muted
            loop
            playsInline
            preload="none"
          />
        ) : null}
      </div>
      <div className="card-body">
        <h3>{template.name}</h3>
        {template.blurb ? <p className="card-prompt">{template.blurb}</p> : null}
        <div className="meta">
          <span className="tag hot">{template.credit_cost} cr</span>
          <span className="tag">{photoLabel(template.photo_count)}</span>
          <span className="tag">{template.duration_sec}s</span>
          {template.cross_count > 0 ? <span className="tag">trending</span> : <span className="tag">exclusive</span>}
          {template.video_url ? <span className="tag play">hover to play</span> : null}
        </div>
      </div>
    </Link>
  );
}

type Facet = { key: string; label: string; count: number };

export function Catalog({
  templates,
  initialCategory,
  initialQuery = "",
  initialSort = "priority",
}: {
  templates: Template[];
  initialCategory?: string;
  initialQuery?: string;
  initialSort?: "priority" | "new" | "photos";
}) {
  const [query, setQuery] = useState(initialQuery);
  const [active, setActive] = useState<Set<string>>(
    () => new Set(initialCategory ? [`category:${initialCategory}`] : []),
  );
  const [sort, setSort] = useState<"priority" | "new" | "photos">(initialSort);

  const categories = useMemo(
    () =>
      [...new Set(templates.map((t) => t.category).filter((v): v is string => Boolean(v)))]
        .sort()
        .map<Facet>((key) => ({ key: `category:${key}`, label: key, count: templates.filter((t) => t.category === key).length })),
    [templates],
  );

  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const template of templates) {
      for (const tag of template.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map<Facet>(([tag, count]) => ({ key: `tag:${tag}`, label: `#${tag}`, count }));
  }, [templates]);

  function toggle(key: string) {
    setActive((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const visible = useMemo(() => {
    // Prompt-bar queries arrive as natural language ("my cat doing a victory dance"),
    // so match on any meaningful word instead of the whole string.
    const words = query
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length >= 3);
    const rows = templates.filter((template) => {
      for (const key of active) {
        if (key.startsWith("category:") && template.category !== key.slice(9)) return false;
        if (key.startsWith("tag:") && !template.tags.includes(key.slice(4))) return false;
      }
      if (words.length === 0) return true;
      const haystack = [template.name, template.slug, template.category ?? "", ...template.tags]
        .join(" ")
        .toLowerCase();
      return words.some((word) => haystack.includes(word));
    });
    return rows.slice().sort((a, b) => {
      if (sort === "photos") return b.photo_count - a.photo_count || a.name.localeCompare(b.name);
      if (sort === "new") return (b.first_seen ?? "").localeCompare(a.first_seen ?? "") || b.priority - a.priority;
      return b.priority - a.priority || b.cross_count - a.cross_count || a.name.localeCompare(b.name);
    });
  }, [templates, query, active, sort]);

  const filtersOn = active.size > 0 || query.trim() !== "";

  return (
    <div>
      <div className="filters">
        <input
          aria-label="Search templates"
          placeholder="Search name or tag"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select aria-label="Sort templates" value={sort} onChange={(event) => setSort(event.target.value as "priority" | "new" | "photos")}>
          <option value="priority">Sort by heat</option>
          <option value="new">Sort by first seen</option>
          <option value="photos">Sort by photo count</option>
        </select>
        {filtersOn ? (
          <button
            type="button"
            className="chip"
            onClick={() => {
              setActive(new Set());
              setQuery("");
            }}
          >
            clear ×
          </button>
        ) : null}
      </div>

      <div className="facet-block">
        <p className="facet-label">Category</p>
        <div className="chip-row">
          {categories.map((facet) => (
            <button
              key={facet.key}
              type="button"
              className={active.has(facet.key) ? "chip on" : "chip"}
              aria-pressed={active.has(facet.key)}
              onClick={() => toggle(facet.key)}
            >
              {facet.label} <span className="chip-count">{facet.count}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="facet-block">
        <p className="facet-label">Tags</p>
        <div className="chip-row">
          {tags.map((facet) => (
            <button
              key={facet.key}
              type="button"
              className={active.has(facet.key) ? "chip on" : "chip"}
              aria-pressed={active.has(facet.key)}
              onClick={() => toggle(facet.key)}
            >
              {facet.label} <span className="chip-count">{facet.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="section-head">
        <h2>Catalog</h2>
        <span className="muted">
          {visible.length} of {templates.length} templates
        </span>
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
