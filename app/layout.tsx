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
          EffectLab recreates trending video effects with your own photos. Pick a template, upload stills, and render the same clip with your face or pet.
        </footer>
      </body>
    </html>
  );
}
