const PACKS = {
  starter: { credits: 20, label: "Starter" },
  studio: { credits: 60, label: "Studio" },
} as const;

type PackId = keyof typeof PACKS;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { pack?: string };
  const pack: PackId = body.pack === "studio" ? "studio" : "starter";
  const selected = PACKS[pack];
  return Response.json(
    {
      ok: false,
      code: "stripe_not_configured",
      pack,
      label: selected.label,
      credits: selected.credits,
      checkout_url: null,
      message:
        "Stripe Checkout is reserved and not connected in this MVP. No charge was created and no credits were added.",
    },
    { status: 501 },
  );
}
