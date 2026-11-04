"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function Header() {
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/me/credits", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { balance?: number }) => {
        if (live && typeof data.balance === "number") setBalance(data.balance);
      })
      .catch(() => {
        if (live) setBalance(null);
      });
    return () => {
      live = false;
    };
  }, []);

  return (
    <header className="site-header">
      <Link href="/" className="brand">
        <span className="mark">EL</span>
        EffectLab
      </Link>
      <nav className="nav">
        <Link href="/account" className="ghost">
          Ledger
        </Link>
        <Link href="/account" className="credit-pill">
          {balance === null ? "Credits" : `${balance} ${balance === 1 ? "credit" : "credits"}`}
        </Link>
      </nav>
    </header>
  );
}
