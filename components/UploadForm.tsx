"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { RENDER_TYPE_LABEL, type RenderType } from "@/lib/render-models";
import type { Template } from "@/lib/types";

const GUIDANCE: Record<RenderType, string> = {
  motion_transfer:
    "Use a full-body photo. The routine is copied from a motion reference, so the whole body should be in frame, with the face visible and one subject per photo.",
  face_swap: "Use a clear, front-facing face photo. The template keeps its scene and swaps in this person.",
  image_to_video: "Use a clear photo of the subject. The clip is generated from these stills and this template's prompt.",
};

const SLOT_LABEL: Record<RenderType, string> = {
  motion_transfer: "Full-body photo",
  face_swap: "Face photo",
  image_to_video: "Photo",
};

export function UploadForm({
  template,
}: {
  template: Pick<Template, "id" | "photo_count" | "credit_cost"> & { renderType?: RenderType };
}) {
  const renderType = template.renderType ?? "image_to_video";
  const router = useRouter();
  const [files, setFiles] = useState<(File | null)[]>(() => Array.from({ length: template.photo_count }, () => null));
  const [previews, setPreviews] = useState<(string | null)[]>(() => Array.from({ length: template.photo_count }, () => null));
  const previewsRef = useRef(previews);
  previewsRef.current = previews;
  const [balance, setBalance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let live = true;
    fetch("/api/me/credits", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { balance?: number }) => {
        if (live && typeof data.balance === "number") setBalance(data.balance);
      })
      .catch(() => {
        if (live) setError("Could not load the credit balance.");
      });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      for (const url of previewsRef.current) {
        if (url) URL.revokeObjectURL(url);
      }
    };
  }, []);

  const ready = files.every((file) => file);
  const short = balance !== null && balance < template.credit_cost;

  function assignFile(index: number, file: File | null) {
    setFiles((current) => current.map((item, itemIndex) => (itemIndex === index ? file : item)));
    setPreviews((current) => {
      const next = current.slice();
      if (next[index]) URL.revokeObjectURL(next[index]);
      next[index] = file ? URL.createObjectURL(file) : null;
      return next;
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || short || pending) return;
    setPending(true);
    setError(null);
    const body = new FormData();
    body.set("templateId", template.id);
    for (const file of files) {
      if (file) body.append("images", file);
    }
    const response = await fetch("/api/jobs", { method: "POST", body });
    const payload = (await response.json()) as { error?: string; code?: string; job?: { id: string } };
    if (!response.ok || !payload.job) {
      setError(payload.error || "Could not start the job.");
      setPending(false);
      const credits = await fetch("/api/me/credits", { cache: "no-store" }).then((res) => res.json());
      if (typeof credits.balance === "number") setBalance(credits.balance);
      return;
    }
    setFiles(Array.from({ length: template.photo_count }, () => null));
    setPreviews((current) => {
      for (const url of current) if (url) URL.revokeObjectURL(url);
      return Array.from({ length: template.photo_count }, () => null);
    });
    setPending(false);
    router.push(`/jobs/${payload.job.id}`);
  }

  return (
    <form onSubmit={onSubmit} className="stack">
      <p className="muted">
        Cost is {template.credit_cost} {template.credit_cost === 1 ? "credit" : "credits"}.
        {balance === null ? "" : ` Available balance: ${balance}.`}
      </p>
      <p className="muted">
        <span className="tag">{RENDER_TYPE_LABEL[renderType]}</span> {GUIDANCE[renderType]}
      </p>
      <div className="slots">
        {files.map((_, index) => (
          <label className="slot" key={index}>
            <span>
              {SLOT_LABEL[renderType]} {index + 1}
            </span>
            {previews[index] ? <img src={previews[index]} alt={`Selected photo ${index + 1}`} /> : <span className="muted">JPEG, PNG, or WebP</span>}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => assignFile(index, event.target.files?.[0] ?? null)}
            />
          </label>
        ))}
      </div>
      {error ? <p className="error" role="alert">{error}</p> : null}
      <div className="actions">
        <button className="btn primary" type="submit" disabled={!ready || short || pending}>
          {pending ? "Starting" : short ? "Not enough credits" : "Generate"}
        </button>
        {short ? (
          <a className="btn" href="/account">
            Credit packs are stubbed
          </a>
        ) : null}
      </div>
    </form>
  );
}
