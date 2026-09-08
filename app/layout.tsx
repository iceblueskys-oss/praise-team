import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '950 찬양팀',
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
        {/* GitHub Pages 서브경로(/praise-team/)를 포함한 명시적 경로 */}
        <link rel="icon" type="image/png" sizes="180x180" href="/praise-team/apple-touch-icon.png?v=5" />
        <link rel="shortcut icon" href="/praise-team/apple-touch-icon.png?v=5" />
        <link rel="apple-touch-icon" sizes="180x180" href="/praise-team/apple-touch-icon.png?v=5" />
      </head>
      <body>{children}</body>
    </html>
  );
}
