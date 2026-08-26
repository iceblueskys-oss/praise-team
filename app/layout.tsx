import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Praise Team Hub",
  description: "Worship Team Setlist & Score Manager",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
