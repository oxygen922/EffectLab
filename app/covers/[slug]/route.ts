import { findTemplate } from "@/lib/catalog";
import { coverSvg } from "@/lib/covers";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const template = findTemplate(slug);
  if (!template) {
    return new Response("Cover not found.", { status: 404 });
  }
  return new Response(coverSvg(template.slug, template.name), {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=86400",
    },
  });
}
