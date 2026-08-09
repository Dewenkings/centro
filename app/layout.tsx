import type { Metadata, Viewport } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";

export const metadata: Metadata = {
  title: "Centro - 多人聚会地点推荐",
  description: "基于 AI Agent 的智能聚会选址助手",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full">
      <body className="h-[100dvh] min-h-[100svh] w-full overflow-hidden bg-gray-50">
        {children}
      </body>
    </html>
  );
}
