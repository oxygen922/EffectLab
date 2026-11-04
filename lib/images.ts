import { mkdir, rm, writeFile } from "fs/promises";
import path from "path";
import { AppError } from "./errors";

const MIME_EXT = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type ImageMime = keyof typeof MIME_EXT;

export type StoredImage = {
  bytes: Buffer;
  mime: ImageMime;
};

const MAX_BYTES = 8 * 1024 * 1024;

export function sniffImage(bytes: Buffer, mime: ImageMime): boolean {
  if (mime === "image/jpeg") return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/png") {
    return bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  }
  return (
    bytes.length > 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  );
}

export function detectMime(bytes: Buffer, declared: string): ImageMime | null {
  const candidate = declared as ImageMime;
  if (candidate in MIME_EXT && sniffImage(bytes, candidate)) return candidate;
  const order: ImageMime[] = ["image/png", "image/jpeg", "image/webp"];
  return order.find((mime) => sniffImage(bytes, mime)) ?? null;
}

export function assertImage(file: StoredImage): void {
  if (file.bytes.length < 32) {
    throw new AppError("invalid_image", "One of the photos is empty.", 400);
  }
  if (file.bytes.length > MAX_BYTES) {
    throw new AppError("invalid_image", "Each photo must be 8 MB or smaller.", 400);
  }
  if (!sniffImage(file.bytes, file.mime)) {
    throw new AppError("invalid_image", "Upload JPEG, PNG, or WebP photos only.", 400);
  }
}

export function uploadsDir(jobId: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) {
    throw new AppError("bad_job", "Job id is not valid.", 400);
  }
  return path.join(process.cwd(), "data", "uploads", jobId);
}

export async function saveJobImages(jobId: string, files: StoredImage[]): Promise<string[]> {
  const dir = uploadsDir(jobId);
  await mkdir(dir, { recursive: true });
  const relative: string[] = [];
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    assertImage(file);
    const ext = MIME_EXT[file.mime];
    const name = `${index}.${ext}`;
    await writeFile(path.join(dir, name), file.bytes);
    relative.push(path.join("data", "uploads", jobId, name));
  }
  return relative;
}

export async function removeJobImages(jobId: string): Promise<void> {
  await rm(uploadsDir(jobId), { recursive: true, force: true });
}

export function mimeFromExt(ext: string): ImageMime | null {
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return null;
}
