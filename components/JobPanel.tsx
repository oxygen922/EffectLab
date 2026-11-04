"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { JobPublic } from "@/lib/types";

const STEPS = ["pending", "running", "done"] as const;

export function JobPanel({ id }: { id: string }) {
  const [job, setJob] = useState<JobPublic | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function tick() {
      const response = await fetch(`/api/jobs/${id}`, { cache: "no-store" });
      if (stop) return;
      if (response.status === 404) {
        setError("This job is not on the current session.");
        return;
      }
      const payload = (await response.json()) as { job?: JobPublic; error?: string };
      if (!response.ok || !payload.job) {
        setError(payload.error || "Could not read the job.");
        return;
      }
      setJob(payload.job);
      if (payload.job.status === "done" || payload.job.status === "failed") return;
      timer = setTimeout(tick, 1000);
    }

    tick().catch(() => {
      if (!stop) setError("Could not read the job.");
    });
    return () => {
      stop = true;
      if (timer) clearTimeout(timer);
    };
  }, [id]);

  if (error) return <p className="error">{error}</p>;
  if (!job) return <p className="muted">Loading job…</p>;

  return (
    <div className="stack">
      <div className="panel">
        <p className="kicker">{job.provider} provider</p>
        <h1 className="serif">{job.templateName}</h1>
        <div className="stepper" aria-label="Job status">
          {STEPS.map((step, index) => {
            const activeIndex = job.status === "failed" ? STEPS.length - 1 : STEPS.indexOf(job.status as (typeof STEPS)[number]);
            const label = step === "done" && job.status === "failed" ? "failed" : step;
            return (
              <span key={step} className={index <= activeIndex ? "step on" : "step"}>
                {label}
              </span>
            );
          })}
        </div>
        <p className="muted">
          {job.creditCost} {job.creditCost === 1 ? "credit" : "credits"} {job.creditsState}. {job.imageCount} photo input.
          {job.status === "pending" || job.status === "running" ? " The mock renderer finishes in a few seconds." : ""}
        </p>
        {job.error ? <p className="error">{job.error}</p> : null}
        <p>
          <Link href={`/templates/${job.templateSlug}`}>Back to template</Link>
        </p>
      </div>
      {job.status === "done" && job.resultUrl ? (
        <div className="stage">
          <object data={job.resultUrl} type="image/svg+xml" aria-label={`${job.templateName} mock render`}>
            Mock clip
          </object>
        </div>
      ) : null}
    </div>
  );
}
