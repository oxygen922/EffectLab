"use client";

import { useState } from "react";
import type { PackId } from "@/lib/packs";

export function BuyButton({ pack, label }: { pack: PackId; label: string }) {
  const [state, setState] = useState<"idle" | "busy" | "blocked">("idle");
  const [message, setMessage] = useState("");

  async function buy() {
    setState("busy");
    setMessage("");
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pack }),
      });
      const data = (await response.json()) as { checkout_url?: string | null; message?: string };
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
        return;
      }
      setMessage(data.message ?? "Checkout is unavailable right now.");
      setState("blocked");
    } catch {
      setMessage("Checkout is unavailable right now.");
      setState("blocked");
    }
  }

  return (
    <span className="buy-wrap">
      <button type="button" className="btn primary" onClick={buy} disabled={state === "busy"}>
        {state === "busy" ? "Opening checkout…" : label}
      </button>
      {message ? <small className="muted">{message}</small> : null}
    </span>
  );
}
