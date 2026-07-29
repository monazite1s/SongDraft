import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "SongDraft — 灵感捕捉与歌曲 Demo 协作",
  description: "把零散灵感整理成可试听、可分享、可协作的歌曲 Demo。",
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className="bg-background">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
