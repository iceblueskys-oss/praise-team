import 입력 { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "찬양팀 악보 & 콘티",
  description: "실시간 찬양팀 콘티 및 악보 뷰어",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  minimumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export 기본 function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="overflow-x-hidden">
      <body className="antialiased select-none overflow-x-hidden w-full max-w-[100vw]">
        {children}
      </body>
    </html>
  );
}
