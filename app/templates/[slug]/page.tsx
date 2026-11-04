import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UploadForm } from "@/components/UploadForm";
import { findTemplate, loadTemplates } from "@/lib/catalog";
import { siteLabel } from "@/lib/types";

export function generateStaticParams() {
  return loadTemplates().map((template) => ({ slug: template.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const template = findTemplate(slug);
  return { title: template ? `${template.name} · EffectLab` : "Template · EffectLab" };
}

export default async function TemplatePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const template = findTemplate(slug);
  if (!template) notFound();

  return (
    <main className="wrap detail">
      <img className="cover" src={template.cover} alt={`${template.name} cover`} />
      <div className="stack">
        <p className="kicker">{template.origin === "manual" ? "Original template" : `${template.cross_count} public catalogs`}</p>
        <h1>{template.name}</h1>
        <div className="meta">
          <span className="tag hot">
            {template.credit_cost} {template.credit_cost === 1 ? "credit" : "credits"}
          </span>
          <span className="tag">{template.photo_count === 1 ? "1 photo" : `${template.photo_count} photos`}</span>
          <span className="tag">{template.duration_sec}s</span>
          <span className="tag">{template.aspect_ratio}</span>
          {template.category ? <span className="tag">{template.category}</span> : null}
          {template.first_seen ? <span className="tag">since {template.first_seen}</span> : null}
          {template.tags.map((tag) => (
            <span className="tag" key={tag}>
              {tag}
            </span>
          ))}
        </div>
        {template.sites.length > 0 ? (
          <p className="muted">Seen on {template.sites.map(siteLabel).join(", ")}. Names only. No sample media is copied.</p>
        ) : (
          <p className="muted">Manual EffectLab template. It is kept across catalog imports.</p>
        )}
        <UploadForm template={template} />
        <p>
          <Link href="/">All templates</Link>
        </p>
      </div>
    </main>
  );
}
