import { BuyButton } from "@/components/BuyButton";
import { FREE_TIER, PACKS } from "@/lib/packs";
import { MODEL_CATALOG, TIER_META, type ModelTier } from "@/lib/models";

const TIERS: ModelTier[] = ["standard", "pro", "flagship"];

const PACK_FAQ: { q: string; a: string }[] = [
  {
    q: "Do credits expire?",
    a: "No. Packs are a one-time purchase, and unused credits stay on your balance.",
  },
  {
    q: "What does a credit buy?",
    a: "Standard models cost 1 credit, Pro models 2, and Flagship models 4. The exact price is shown before you approve a render.",
  },
  {
    q: "What if a render fails?",
    a: "Credits held for a failed render return to your balance automatically. You only spend credits on clips that finish.",
  },
  {
    q: "Can I use the videos commercially?",
    a: "Clips from paid credit packs are cleared for commercial use. Free-tier renders are for personal projects.",
  },
];

function tierTools(tier: ModelTier): string {
  return Object.values(MODEL_CATALOG)
    .filter((model) => model.tier === tier)
    .map((model) => model.name)
    .join(" · ");
}

function renderLine(credits: number): string {
  return `${credits} standard · ${credits / 2} pro · ${credits / 4} flagship renders`;
}

function centsPerCredit(price: number, credits: number): string {
  return `${Math.round((price / credits) * 100)}¢`;
}

export function Pricing() {
  return (
    <section className="upgrade">
      <div className="upgrade-head">
        <p className="kicker">Upgrade</p>
        <h1>Choose your pack</h1>
        <p className="lede">
          One-time credit packs for the lab. Nothing expires — you pay for the renders you make, not a seat you leave empty.
        </p>
      </div>

      <aside className="free-callout">
        <div>
          <p className="kicker">Free tier</p>
          <p>
            <b>{FREE_TIER.starterCredits} starter credits</b> on every account, plus <b>{FREE_TIER.dailyCredits} fresh credits every day</b>. No card required.
          </p>
        </div>
        <p className="free-note">{FREE_TIER.note}</p>
      </aside>

      <div className="pricing-grid">
        {Object.values(PACKS).map((pack) => {
          const recommended = "recommended" in pack && pack.recommended;
          const save = Math.round((1 - pack.price / pack.listPrice) * 100);
          return (
            <article key={pack.id} className={`price-card${recommended ? " featured" : ""}`}>
              <div className="price-badges">
                {recommended ? <span className="rec-pill">Recommended</span> : null}
                <span className="save-pill">Save {save}%</span>
              </div>
              <div className="price-head">
                <h2>{pack.label}</h2>
                <p className="price">
                  <s>${pack.listPrice}</s>
                  <span>${pack.price}</span>
                </p>
              </div>
              <p className="pack-credits">
                <b>{pack.credits}</b> credits, one-time
              </p>
              <ul>
                <li>{renderLine(pack.credits)}</li>
                <li>All models, Kling 2.1 &amp; Hailuo 02 included</li>
                <li>{centsPerCredit(pack.price, pack.credits)} per standard render</li>
                {pack.id === "studio" ? <li>Priority render queue</li> : null}
              </ul>
              <BuyButton pack={pack.id} label={`Get ${pack.label}`} />
            </article>
          );
        })}
      </div>

      <div className="tier-block">
        <p className="muted">Credits pay per render. Larger models burn more.</p>
        <div className="tier-row">
          {TIERS.map((tier) => (
            <div key={tier} className="tier-card">
              <b>{TIER_META[tier].label}</b>
              <span>{TIER_META[tier].rate}</span>
              <small>{tierTools(tier)}</small>
            </div>
          ))}
        </div>
      </div>

      <div className="section-head">
        <h2>Pack questions</h2>
      </div>
      <div className="faq">
        {PACK_FAQ.map((item) => (
          <details key={item.q}>
            <summary>{item.q}</summary>
            <p>{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
