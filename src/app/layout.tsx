import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Activision Blizzard King | Audience Intelligence Engine",
  description: "Unified Player Graph, Battle.net Cross-Title Gravity, Situational Triggers, and DeepSona Synthetic Multi-Agent Testing across Call of Duty, World of Warcraft, Diablo IV, Overwatch 2, and Candy Crush Saga.",
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
