import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "2K Courtside | Audience Intelligence",
  description:
    "Cross-title player identity, NBA 2K26 to 2K27 lifecycle cohorts, cross-franchise pollination, and courtside offer testing across the 2K portfolio.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "2K Courtside | Audience Intelligence",
    description:
      "2K portfolio player identity graph, lifecycle cohorts, and live offer testing.",
    images: ["/brands/2k/og-courtside.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-brand="2k" className="dark">
      <body className="bg-[#06080E] text-white antialiased min-h-screen w-screen overflow-hidden">
        {children}
      </body>
    </html>
  );
}
