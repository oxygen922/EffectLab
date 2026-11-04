import { findTemplate } from "@/lib/catalog";
import { errorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await context.params;
    const template = findTemplate(slug);
    if (!template) {
      return Response.json({ error: "Template not found.", code: "not_found" }, { status: 404 });
    }
    return Response.json({ template });
  } catch (error) {
    return errorResponse(error);
  }
}
