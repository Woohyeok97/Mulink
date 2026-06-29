import 'server-only';
import { cache } from 'react';
import { createClient } from '@/shared/lib/supabase/server';
import type { LessonRequest, LessonOffer } from './lesson-request.type';

// 현재 로그인한 학생의 레슨 신청 1건을 가져온다. 비로그인이거나 신청 없으면 null.
// cache()로 감싸 같은 요청 안에서 여러 번 호출해도 실제 실행은 1번만 일어난다.
export const getMyLessonRequest = cache(async (): Promise<LessonRequest | null> => {
  const supabase = await createClient();

  // 쿠키에서 세션의 access_token을 꺼낸다. 토큰 검증은 백엔드 Guard가 수행한다.
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) return null; // 세션 없음 = 비로그인

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/lesson-requests/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!response.ok) return null; // 토큰 무효/만료 등으로 Guard가 막으면 401 → null

  // 백엔드가 findFirst라 신청 없으면 null 또는 빈 바디를 반환할 수 있다.
  const text = await response.text();
  if (!text) return null;

  const data = JSON.parse(text) as LessonRequest | null;
  if (!data || !data.id) return null;

  return data;
});

// 현재 로그인한 학생의 레슨 신청에 달린 코치 제안 리스트를 가져온다.
// 비로그인이거나 오류 시 빈 배열 반환.
export const getMyLessonOffers = cache(async (): Promise<LessonOffer[]> => {
  const supabase = await createClient();

  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) return [];

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/lesson-requests/me/offers`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!response.ok) return [];

  return (await response.json()) as LessonOffer[];
});
