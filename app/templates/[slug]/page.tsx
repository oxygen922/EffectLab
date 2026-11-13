import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UploadForm } from "@/components/UploadForm";
import { findTemplate, loadTemplates } from "@/lib/catalog";
import { TIER_META, renderPlanForTemplate } from "@/lib/models";
import { findRecipe } from "@/lib/recipes";
import { RENDER_TYPE_LABEL } from "@/lib/render-models";
import { requireRenderRecord } from "@/lib/render-types";

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
  const recipe = findRecipe(slug);
  const plan = renderPlanForTemplate(slug, template.credit_cost);
  const render = requireRenderRecord(slug);

  return (
    <main className="wrap detail">
      {template.video_url ? (
        <video
          className="cover"
          src={template.video_url}
          poster={template.preview_poster_url ?? undefined}
          controls
          autoPlay
          muted
          loop
          playsInline
          aria-label={`${template.name} preview`}
        />
      ) : (
        <img className="cover" src={template.preview_poster_url ?? template.cover} alt={`${template.name} preview`} />
      )}
      <div className="stack">
        <p className="kicker">
          {template.origin === "manual" ? "EffectLab exclusive" : "Recreate this trend"}
        </p>
        <h1>{template.name}</h1>
        {template.blurb ? <p className="lede">{template.blurb}</p> : null}
        <div className="meta">
          <span className="tag hot">
            {plan.unitCost} {plan.unitCost === 1 ? "credit" : "credits"}
          </span>
          {plan.tier ? <span className="tag play">{TIER_META[plan.tier].label} model</span> : null}
          {plan.modelNames.length > 0 ? <span className="tag">{plan.modelNames.join(" + ")}</span> : null}
          <span className="tag">{RENDER_TYPE_LABEL[render.renderType]}</span>
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
          <p className="muted">A trending effect, recreated with your photos. Upload the stills below and make this clip yours.</p>
        ) : (
          <p className="muted">An EffectLab original. Upload your stills and the lab renders this clip for you.</p>
        )}
        <UploadForm
          template={{
            id: template.id,
            photo_count: template.photo_count,
            credit_cost: plan.unitCost,
            renderType: render.renderType,
          }}
        />
        {recipe ? (
          <div className="panel recipe">
            <p className="kicker">How it&apos;s made</p>
            <div className="meta">
              <span className="tag hot">{recipe.pipeline === "direct" ? "direct output" : "storyboard first"}</span>
              <span className="tag">{recipe.steps.length} steps</span>
              {recipe.source === "curated" ? <span className="tag play">curated</span> : <span className="tag">draft</span>}
            </div>
            <ol className="steps">
              {recipe.steps.map((step, index) => (
                <li key={index}>
                  <span className="tag hot">{step.tool}</span> <span className="muted">{step.action}</span> — {step.input} → {step.output}
                </li>
              ))}
            </ol>
            {recipe.notes ? <p className="muted">{recipe.notes}</p> : null}
            <p className="muted">
              <Link href="/recipes">Browse the full generation library</Link>
            </p>
          </div>
        ) : null}
        <p>
          <Link href="/templates">All templates</Link>
        </p>
      </div>
    </main>
  );
}
