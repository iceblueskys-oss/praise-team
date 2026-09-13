import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '950 찬양팀',
  description: '950 예배 찬양팀 콘티 및 악보 뷰어',
  // 🌟 아이폰 홈 화면에 추가했을 때 브라우저 주소창 없이 "진짜 앱"처럼 열리도록 설정
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: '950 찬양팀',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // 기존 globals.css의 pan-y 전용 터치 정책과 통일: 페이지 자체 핀치줌은 막고
  // 악보 뷰어 내부의 자체 확대/축소 로직만 사용하도록 함
  maximumScale: 1,
  userScalable: false,
  // 🌟 iPhone 노치/다이나믹 아일랜드·하단 홈 인디케이터 영역까지 화면을 채우는 핵심 옵션.
  // 이게 없으면 코드 곳곳의 env(safe-area-inset-*) 값이 항상 0으로 처리되어 무의미해짐.
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F7F5F0' },
    { media: '(prefers-color-scheme: dark)', color: '#1A1816' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        {/* public 단어를 빼고 저장소 경로(/praise-team/)로 바로 연결 */}
        <link rel="icon" type="image/png" sizes="180x180" href="/praise-team/apple-touch-icon.png?v=10" />
        <link rel="shortcut icon" href="/praise-team/apple-touch-icon.png?v=10" />
        <link rel="apple-touch-icon" sizes="180x180" href="/praise-team/apple-touch-icon.png?v=10" />
      </head>
      <body>{children}</body>
    </html>
  );
}
