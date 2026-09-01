import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '950 찬양팀 Hub',
  description: '950 예배 찬양팀 콘티 및 악보 뷰어',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <link rel="icon" href="/praise-team/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/praise-team/apple-touch-icon.png" />
      </head>
      <body>{children}</body>
    </html>
  );
}
