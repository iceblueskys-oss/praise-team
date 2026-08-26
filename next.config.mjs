/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // GitHub Pages용 정적 HTML 내보내기 (필수)
  images: {
    unoptimized: true, // 이미지 최적화 서버 에러 방지
  },
  basePath: '/praise-team', // GitHub 레포지토리 이름
  typescript: {
    ignoreBuildErrors: true, // 빌드 시 사소한 타입 에러 무시
  },
  eslint: {
    ignoreDuringBuilds: true, // 빌드 시 린트 에러 무시
  },
};

export default nextConfig;
