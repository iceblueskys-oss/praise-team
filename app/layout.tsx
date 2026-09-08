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
        {/* 일반 브라우저 탭 파비콘 (상대 경로 지정) */}
        <link rel="icon" type="image/png" sizes="180x180" href="./apple-touch-icon.png?v=4" />
        <link rel="shortcut icon" href="./apple-touch-icon.png?v=4" />

        {/* 모바일 홈 화면 추가 아이콘 */}
        <link rel="apple-touch-icon" sizes="180x180" href="./apple-touch-icon.png?v=4" />
      </head>
      <body>{children}</body>
    </html>
  );
}
