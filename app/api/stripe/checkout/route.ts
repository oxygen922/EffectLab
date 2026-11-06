import { PACKS, type PackId } from "@/lib/packs";

const IDS: PackId[] = ["starter", "creator", "studio"];

function isPackId(value: string): value is PackId {
  return (IDS as string[]).includes(value);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { pack?: string };
  const pack: PackId = body.pack && isPackId(body.pack) ? body.pack : "creator";
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
