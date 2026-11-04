export async function POST() {
  return Response.json({
    ok: true,
    received: true,
    applied: false,
    message: "Stripe webhook stub. Signature checks and credit grants are not enabled.",
  });
}
