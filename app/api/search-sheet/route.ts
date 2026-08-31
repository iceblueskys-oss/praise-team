import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json({ images: [] });
  }

  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_ENGINE_ID;

  if (!apiKey || !cx) {
    return NextResponse.json(
      { error: 'Google API 설정이 누락되었습니다. (.env.local 확인)' },
      { status: 500 }
    );
  }

  try {
    // Google Custom Search JSON API - 이미지 전용 검색 호출
    const googleApiUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(
      `${query} 악보`
    )}&searchType=image&num=10&safe=active`;

    const res = await fetch(googleApiUrl);
    const data = await res.json();

    if (data.items && Array.isArray(data.items)) {
      const images = data.items.map((item: any) => ({
        url: item.link, // 원본 이미지 URL
        thumbnail: item.image?.thumbnailLink || item.link, // 썸네일
        title: item.title,
        contextLink: item.image?.contextLink,
      }));
      return NextResponse.json({ images });
    }

    return NextResponse.json({ images: [] });
  } catch (error: any) {
    console.error('구글 이미지 검색 API 에러:', error);
    return NextResponse.json({ error: error.message || '검색 실패' }, { status: 500 });
  }
}
