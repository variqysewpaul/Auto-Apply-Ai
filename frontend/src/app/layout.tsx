import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AutoApply Pro | AI-Powered Job Application Automation",
  description: "Automate your job search. Use advanced LLMs to solve custom easy-apply forms, generate hyper-tailored cover letters, and track applications in real-time.",
  applicationName: "AutoApply Pro",
  keywords: ["job search", "automation", "easy apply", "ai cover letter", "linkedin bot", "playwright stealth"],
  authors: [{ name: "DeepMind Advanced Agentic Coding Team" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body>{children}</body>
    </html>
  );
}
