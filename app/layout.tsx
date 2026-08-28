import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "찬양팀 콘티 & 악보",
  description: "실시간 찬양팀 콘티 및 악보 뷰어 앱",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "찬양팀",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="overflow-x-hidden">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="antialiased select-none overflow-x-hidden w-full max-w-[100vw]">
        {children}
      </body>
    </html>
  );
}
