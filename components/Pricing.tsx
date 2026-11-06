import { BuyButton } from "@/components/BuyButton";
import { FREE_TIER, PACKS } from "@/lib/packs";
import { MODEL_CATALOG, TIER_META, type ModelTier } from "@/lib/models";

function tierTools(tier: ModelTier): string {
  return Object.values(MODEL_CATALOG)
    .filter((model) => model.tier === tier)
    .map((model) => model.name)
    .join(" · ");
}

function renderLine(credits: number): string {
  return `${credits} standard · ${credits / 2} pro · ${credits / 4} flagship renders`;
}

export function Pricing() {
  return (
    <section>
      <div className="section-head">
        <h2>Pick your render fuel</h2>
        <span className="muted">One-time credit packs. Nothing expires.</span>
      </div>
      <p className="muted tier-note">
        Credits pay per render, and bigger models burn more:{" "}
        {(["standard", "pro", "flagship"] as ModelTier[]).map((tier) => (
          <span key={tier} className="tier-chip">
            <b>{TIER_META[tier].label}</b> {TIER_META[tier].rate}
            <small> ({tierTools(tier)})</small>
          </span>
        ))}
      </p>
      <p className="free-line">
        <b>Free to start:</b> every account gets {FREE_TIER.starterCredits} starter credits +
        {" "}{FREE_TIER.dailyCredits} fresh credits every day — {FREE_TIER.note}.
      </p>
      <div className="pricing-grid">
        {Object.values(PACKS).map((pack) => (
          <div key={pack.id} className={`price-card${"recommended" in pack ? " featured" : ""}`}>
            {"recommended" in pack ? <span className="rec-pill">Recommended</span> : null}
            <div className="price-head">
              <b>{pack.label}</b>
              <span className="price">
                <s>${pack.listPrice}</s> ${pack.price}
              </span>
            </div>
            <p className="muted">{pack.credits} credits, one-time.</p>
            <ul>
              <li>{renderLine(pack.credits)}</li>
              <li>All models, Kling 2.1 &amp; Hailuo 02 included</li>
              <li>~{(pack.price / pack.credits * 100).toFixed(0)}¢ per standard render</li>
              {pack.id === "studio" ? <li>Priority render queue</li> : null}
            </ul>
            <BuyButton pack={pack.id} label={`Get ${pack.label}`} />
          </div>
        ))}
      </div>
    </section>
  );
}
