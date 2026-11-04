import type { Metadata } from "next";
import { AccountPanel } from "@/components/AccountPanel";

export const metadata: Metadata = { title: "Credits · EffectLab" };

export default function AccountPage() {
  return (
    <main className="wrap narrow" style={{ padding: "32px 0 64px" }}>
      <p className="kicker">Wallet</p>
      <h1>Credits and ledger</h1>
      <p className="lede">New sessions start with a grant. A job holds the template cost, captures it on success, and returns it if the render fails.</p>
      <AccountPanel />
    </main>
  );
}
