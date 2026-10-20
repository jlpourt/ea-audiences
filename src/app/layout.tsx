import type { Metadata } from "next";
import "./globals.css";
import "../styles/tokens.css";

export const metadata: Metadata = {
  title: "Take-Two | Player Graph Command Center",
  description:
    "One player graph across 2K, Rockstar Games and Zynga: 2K core findings, cross-label audiences, synthetic pressure testing and governed activation.",
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
    title: "Take-Two | Player Graph Command Center",
    description:
      "One player graph across 2K, Rockstar Games and Zynga.",
    images: ["/brands/2k/og-courtside.jpg"],
  },
};

/* Applies the persisted v2 theme before first paint so there is no flash.
   Keep the storage key in sync with src/components/v2/shell/ThemeToggle.tsx. */
const THEME_BOOT = `(function(){try{var t=localStorage.getItem('courtside-theme');if(t!=='light'&&t!=='dark'){t='dark';}document.documentElement.setAttribute('data-theme',t);document.documentElement.classList.toggle('dark',t==='dark');}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-brand="2k" data-theme="dark" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body className="bg-[var(--bg)] text-[var(--text)] antialiased min-h-screen w-screen overflow-hidden">
        {children}
      </body>
    </html>
  );
}
