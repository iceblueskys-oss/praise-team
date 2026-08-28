import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "찬양팀 악보 & 콘티",
  description: "실시간 찬양팀 콘티 및 악보 뷰어",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="overflow-x-hidden">
      <head>
        {/* 🌟 Next.js 버전 상관없이 사파리 임의 확대(Zoom)를 원천 차단하는 표준 메타태그 🌟 */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover"
        />
      </head>
      <body className="antialiased select-none overflow-x-hidden w-full max-w-[100vw]">
        {children}
      </body>
    </html>
  );
}
