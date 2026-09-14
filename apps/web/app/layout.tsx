import type {Metadata} from "next";
import type {ReactNode} from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "StudyTube",
  description: "Turn structured study material into animated explainer videos.",
};

export default function RootLayout({children}: Readonly<{children: ReactNode}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
