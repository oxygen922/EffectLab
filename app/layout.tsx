import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Header } from "@/components/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: "EffectLab",
  description: "Pick a face or pet effect, upload photos, and render a short clip against a credit balance.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip" href="#content">
          Skip to content
        </a>
        <Header />
        <div id="content">{children}</div>
        <footer className="site-footer">
          EffectLab stores template metadata, original SVG covers, and mock clips. Competitor sample videos and prompts are not in this repo.
        </footer>
      </body>
    </html>
  );
}
