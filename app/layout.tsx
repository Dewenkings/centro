import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Centro - 多人聚会地点推荐",
  description: "基于 AI Agent 的智能聚会选址助手",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}