"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { JobPublic, LedgerEntry } from "@/lib/types";

const LEDGER_LABEL: Record<LedgerEntry["type"], string> = {
  grant: "Added",
  hold: "Held",
  capture: "Spent",
  release: "Returned",
};

export function AccountPanel() {
  const [balance, setBalance] = useState<number | null>(null);
  const [held, setHeld] = useState(0);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [jobs, setJobs] = useState<JobPublic[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all([
      fetch("/api/me/ledger", { cache: "no-store" }).then((response) => response.json()),
      fetch("/api/me/jobs", { cache: "no-store" }).then((response) => response.json()),
    ])
      .then(([ledger, jobPayload]: [{ balance?: number; held?: number; entries?: LedgerEntry[] }, { jobs?: JobPublic[] }]) => {
        if (!live) return;
        if (typeof ledger.balance === "number") setBalance(ledger.balance);
        if (typeof ledger.held === "number") setHeld(ledger.held);
        setEntries(ledger.entries ?? []);
        setJobs(jobPayload.jobs ?? []);
      })
      .catch(() => {
        if (live) setError("Could not load the ledger.");
      });
    return () => {
      live = false;
    };
  }, []);

  async function buy(pack: "starter" | "studio") {
    setNotice(null);
    const response = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pack }),
    });
    const payload = (await response.json()) as { message?: string };
    setNotice(payload.message || "Stripe is not connected.");
  }

  return (
    <div className="stack">
      <div className="stats">
        <div className="stat">
          <b>{balance === null ? "…" : balance}</b>
          <span>available</span>
        </div>
        <div className="stat">
          <b>{held}</b>
          <span>held on jobs</span>
        </div>
        <div className="stat">
          <b>{jobs.length}</b>
          <span>jobs this session</span>
        </div>
      </div>
      <div className="panel">
        <h2>Add credits</h2>
        <p className="muted">Packs are priced in the stub only. Checkout does not run and the balance does not change.</p>
        <div className="actions">
          <button className="btn primary" type="button" onClick={() => buy("starter")}>
            Starter · 20 credits
          </button>
          <button className="btn" type="button" onClick={() => buy("studio")}>
            Studio · 60 credits
          </button>
        </div>
        {notice ? <p className="notice" role="status">{notice}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </div>
      <div className="panel">
        <h2>Recent jobs</h2>
        {jobs.length === 0 ? <p className="muted">No renders yet.</p> : null}
        <ul>
          {jobs.map((job) => (
            <li key={job.id}>
              <Link href={`/jobs/${job.id}`}>{job.templateName}</Link> · {job.status} · {job.creditsState}
            </li>
          ))}
        </ul>
      </div>
      <div className="panel">
        <h2>Ledger</h2>
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>Type</th>
              <th>Credits</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>{entry.createdAt.slice(0, 19).replace("T", " ")}</td>
                <td>{LEDGER_LABEL[entry.type]}</td>
                <td>{entry.amount}</td>
                <td>{entry.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
