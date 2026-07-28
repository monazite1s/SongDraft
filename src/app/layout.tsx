import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "SongDraft — 灵感捕捉与歌曲 Demo 协作",
  description: "把零散灵感整理成可试听、可分享、可协作的歌曲 Demo。",
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#f8f9fc",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
