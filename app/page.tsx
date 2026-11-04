import { Catalog } from "@/components/Catalog";
import { loadCatalog } from "@/lib/catalog";

export default function HomePage() {
  const catalog = loadCatalog();
  const featured = catalog.templates.filter((template) => template.featured).length;
  return (
    <main className="wrap">
      <section className="hero">
        <div>
          <p className="kicker">Face and pet effects</p>
          <h1>Pick a card. Upload the stills. Spend a credit.</h1>
          <p className="lede">
            EffectLab lists public trend names as original cards. A job holds credits, asks the mock video provider for a clip, and captures the hold only when the render finishes.
          </p>
        </div>
        <div className="stats">
          <div className="stat">
            <b>{catalog.template_count}</b>
            <span>templates</span>
          </div>
          <div className="stat">
            <b>{featured}</b>
            <span>followed now</span>
          </div>
          <div className="stat">
            <b>8</b>
            <span>monitored catalogs</span>
          </div>
        </div>
      </section>
      <Catalog templates={catalog.templates} />
    </main>
  );
}
