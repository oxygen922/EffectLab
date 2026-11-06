import type { Metadata } from "next";
import { Pricing } from "@/components/Pricing";

export const metadata: Metadata = {
  title: "Upgrade · EffectLab",
  description: "One-time EffectLab credit packs. Credits never expire, and you pay per render.",
};

export default function UpgradePage() {
  return (
    <main className="wrap upgrade-page">
      <Pricing />
    </main>
  );
}
