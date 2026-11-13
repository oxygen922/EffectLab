import Link from "next/link";
import { AutoplayVideo } from "@/components/AutoplayVideo";
import { Card } from "@/components/Catalog";
import { PromptBar } from "@/components/PromptBar";
import { loadTemplates } from "@/lib/catalog";
import { renderPlanForTemplate } from "@/lib/models";

const LATEST_COUNT = 12;
const HERO_BG_COUNT = 5;

const FEATURES: { title: string; body: string }[] = [
  {
    title: "Free daily credits",
    body: "Every account starts with 8 starter credits and gets 3 fresh ones each day. Standard models, no card required.",
  },
  {
    title: "Real trends, rebuilt",
    body: "Every template is a trend that is actually circulating, reverse-engineered into a recipe the lab can rerun with your photos.",
  },
  {
    title: "Your face in the lead",
    body: "Drop 1–5 stills. The render keeps you — or your pet — in frame, beat for beat with the original.",
  },
  {
    title: "Pay per render, not per seat",
    body: "Standard models cost 1 credit, Pro 2, Flagship 4. The exact price is shown before you approve anything.",
  },
  {
    title: "Two pipelines",
    body: "Direct effects render in one pass. Cinematic ones storyboard first — reference frames, then the video model.",
  },
  {
    title: "Failed render, full refund",
    body: "If a render fails on our side, held credits return to your balance automatically. You never pay for nothing.",
  },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "What is EffectLab?",
    a: "A lab of effect templates for your face and your pet. Pick a trend, upload your photos, and the lab renders the same clip with you in it.",
  },
  {
    q: "Is it really free to start?",
    a: "Yes. Every account gets 8 starter credits plus 3 free credits every day — enough for a standard render daily without paying anything.",
  },
  {
    q: "How long does a render take?",
    a: "Most renders finish within two minutes. Bigger flagship models take a little longer; the job page updates live.",
  },
  {
    q: "What photos work best?",
    a: "Clear, front-facing stills with good light. One photo per slot, JPEG, PNG, or WebP — the closer the framing to the original, the better the swap.",
  },
  {
    q: "What happens if a render fails?",
    a: "Credits held for a failed render are returned to your balance automatically. You only ever pay for clips that land in your library.",
  },
  {
    q: "Can I use the videos commercially?",
    a: "Clips from paid credit packs are cleared for commercial use. Free-tier renders are for personal projects.",
  },
];

export default function HomePage() {
  const templates = loadTemplates();

  const withVideo = templates.filter((t): t is typeof t & { video_url: string } => t.video_url !== null);
  const posters = templates.filter((t) => t.preview_poster_url);
  const heroBg =
    posters.length <= HERO_BG_COUNT
      ? posters
      : Array.from({ length: HERO_BG_COUNT }, (_, index) => {
          const slot = Math.round((index * (posters.length - 1)) / (HERO_BG_COUNT - 1));
          return posters[slot];
        });
  const demo = withVideo.find((t) => t.photo_count >= 2) ?? withVideo[0];

  const latest = templates
    .slice()
    .sort((a, b) => (b.first_seen ?? "").localeCompare(a.first_seen ?? "") || b.priority - a.priority)
    .slice(0, LATEST_COUNT)
    .map((template) => ({
      ...template,
      credit_cost: renderPlanForTemplate(template.slug, template.credit_cost).unitCost,
    }));

  const categories = [...new Set(templates.map((t) => t.category).filter((v): v is string => Boolean(v)))]
    .map((category) => ({ category, count: templates.filter((t) => t.category === category).length }))
    .sort((a, b) => b.count - a.count);
  const categorized = categories.length;

  return (
    <main>
      <section className="hero-stage">
        <div className="hero-bg" aria-hidden="true">
          <div className="hero-glow" />
          {heroBg.map((template, index) => (
            <div key={template.slug} className={`hero-frame hero-frame-${index + 1}`}>
              <img
                src={template.preview_poster_url ?? template.cover}
                alt=""
                decoding="async"
              />
            </div>
          ))}
          <div className="hero-grain" />
        </div>
        <div className="hero-veil" aria-hidden="true" />
        <div className="wrap hero-center">
          <div className="trust-row">
            <span className="trust-pill">{templates.length} effect templates</span>
            <span className="trust-pill">Free daily credits</span>
            <span className="trust-pill">No card required</span>
          </div>
          <h1>
            One photo. <em>Every</em> effect.
          </h1>
          <p className="lede">
            Describe the trend you want, or pick a template below — the lab renders it with your
            photos. Free credits every day.
          </p>
          <PromptBar />
          {demo ? (
            <div className="demo-panel">
              <div className="demo-flow">
                <p className="demo-tag">Render demo · {demo.category ?? "effect"}</p>
                <p className="bubble user">{demo.blurb ?? `Do the “${demo.name}” effect with my photos`}</p>
                <div className="bubble lab">
                  <span>Matched 1 template — needs {demo.photo_count === 1 ? "1 photo" : `${demo.photo_count} photos`}:</span>
                  <span className="demo-tpl">
                    <img src={demo.preview_poster_url ?? demo.cover} alt="" />
                    <b>{demo.name}</b>
                    {demo.tags[0] ? <span className="tag">#{demo.tags[0]}</span> : null}
                  </span>
                </div>
                <div className="bubble lab">
                  <span>Your photos go here:</span>
                  <span className="demo-slots">
                    {Array.from({ length: demo.photo_count }, (_, index) => (
                      <i key={index} className="demo-slot">
                        photo {index + 1}
                      </i>
                    ))}
                  </span>
                </div>
                <div className="approve">
                  <span className="spec">image-to-video · 9:16 · {demo.duration_sec}s</span>
                  <span className="spec">{renderPlanForTemplate(demo.slug, demo.credit_cost).unitCost} credits · needs your approval</span>
                  <Link className="btn primary sm" href={`/templates/${demo.slug}`}>
                    Approve &amp; generate
                  </Link>
                </div>
              </div>
              <div className="demo-video">
                <AutoplayVideo src={demo.video_url} />
                <span className="demo-cap">rendered with your photo</span>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <div className="wrap">
      <section>
        <div className="section-head">
          <h2>Get inspired</h2>
          <Link href="/templates?sort=new" className="muted">
            View all {templates.length} →
          </Link>
        </div>
        <div className="feature-row">
          {latest.map((template) => (
            <Card key={template.slug} template={template} />
          ))}
        </div>
      </section>

      <section>
        <div className="section-head">
          <h2>Browse by category</h2>
          <span className="muted">{categorized} categories</span>
        </div>
        <div className="cat-grid">
          {categories.map(({ category, count }) => {
            const face = templates.find((t) => t.category === category);
            const poster = face?.preview_poster_url ?? face?.cover;
            return (
              <Link key={category} href={`/templates?category=${category}`} className="cat-card">
                {poster ? <img src={poster} alt="" loading="lazy" /> : null}
                <b>{category}</b>
                <span className="cat-count">{count} effects</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <div className="section-head">
          <h2>Why creators pick the lab</h2>
        </div>
        <div className="feature-grid">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="feature-card">
              <h3>{feature.title}</h3>
              <p className="muted">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="section-head">
          <h2>Frequently asked questions</h2>
        </div>
        <div className="faq">
          {FAQ.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>
      </div>
    </main>
  );
}
