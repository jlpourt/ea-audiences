import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Activision | Call of Duty Audience Intelligence Engine",
  description: "Unified Player Graph, Situational Triggers, and DeepSona Synthetic Multi-Agent Testing across Warzone, Black Ops 6, Modern Warfare III, and CDL Ranked powered by Google Cloud Spanner & Vertex AI.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-foreground antialiased min-h-screen w-screen overflow-hidden">
        {children}
      </body>
    </html>
  );
}
