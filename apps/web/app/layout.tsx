import type {Metadata, Viewport} from "next";
import type {ReactNode} from "react";
import "./globals.css";
import "./prompt.css";
import "./teaching-strategy-modal.css";
import "./jobs.css";
import "./workflow.css";
import "./render-engine.css";
import "./settings.css";
import "./mobile.css";

export const metadata: Metadata = {
  title: "StudyTube",
  description: "Turn structured study material into animated explainer videos.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({children}: Readonly<{children: ReactNode}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
