import { findTemplate } from "@/lib/catalog";
import { errorResponse } from "@/lib/errors";
import { detectMime, type StoredImage } from "@/lib/images";
import { createGenerationJob } from "@/lib/jobs";
import { getOrCreateUserId } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const userId = await getOrCreateUserId();
    const form = await request.formData();
    const templateId = String(form.get("templateId") ?? "");
    const template = findTemplate(templateId);
    if (!template) {
      return Response.json({ error: "Template not found.", code: "not_found" }, { status: 404 });
    }
    const incoming = form.getAll("images").filter((value): value is File => value instanceof File && value.size > 0);
    const files: StoredImage[] = [];
    for (const file of incoming) {
      const bytes = Buffer.from(await file.arrayBuffer());
      const mime = detectMime(bytes, file.type);
      if (!mime) {
        return Response.json(
          { error: "Upload JPEG, PNG, or WebP photos only.", code: "invalid_image" },
          { status: 400 },
        );
      }
      files.push({ bytes, mime });
    }
    const job = await createGenerationJob({ userId, template, files });
    return Response.json({ job }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
