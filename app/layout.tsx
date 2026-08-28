import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "찬양팀 악보 & 콘티",
  description: "실시간 찬양팀 콘티 및 악보 뷰어",
};

// 🌟 아이폰 사파리 임의 확대 방지 설정 🌟
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased select-none">{children}</body>
    </html>
  );
}
