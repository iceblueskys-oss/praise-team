import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json({ images: [] });
  }

  try {
    // 서버 환경에서 모바일 User-Agent 헤더를 사용하여 봇 차단을 우회하고 깨끗한 썸네일 추출
    const targetUrl = `https://search.daum.net/search?w=img&q=${encodeURIComponent(query)}`;
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      next: { revalidate: 3600 },
    });

    const html = await response.text();

    // 정규식을 통해 이미지 원본 및 썸네일 URL 매칭 추출
    const imageUrlRegex = /https?:\/\/[^"'\s]+\.(?:png|jpg|jpeg|webp)/gi;
    const allMatches = html.match(imageUrlRegex) || [];

    const filteredImages: string[] = [];
    for (const url of allMatches) {
      if (
        !url.includes('icon') &&
        !url.includes('logo') &&
        !url.includes('profile') &&
        !url.includes('thumb/100x100') &&
        !filteredImages.includes(url)
      ) {
        filteredImages.push(url);
      }
    }

    return NextResponse.json({ images: filteredImages.slice(0, 24) });
  } catch (error) {
    console.error('악보 검색 서버 오류:', error);
    return NextResponse.json({ images: [] }, { status: 500 });
  }
}
