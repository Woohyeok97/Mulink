import { cache } from 'react';
import { createClient } from '@/shared/lib/supabase/server';
import type { User } from './user.type';

// 현재 로그인한 유저 정보를 DB에서 가져온다. 비로그인이면 null.
// cache()로 감싸 같은 요청 안에서 여러 번 호출해도 실제 실행은 1번만 일어난다
// (Header + 페이지 가드 등 여러 곳에서 호출해도 /users/me 왕복은 1회).
// 캐시 범위는 요청 단위라 요청 간에는 공유되지 않아 stale 걱정이 없다.
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();

  // 쿠키에서 세션의 access_token을 꺼낸다. 토큰 검증은 백엔드 Guard가 수행한다.
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) return null; // 세션 없음 = 비로그인

  // 토큰을 실어 백엔드에 요청. 토큰 주인의 정보를 반환하므로 id를 따로 넘기지 않는다.
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!response.ok) return null; // 토큰 무효/만료 등으로 Guard가 막으면 401 → null

  return (await response.json()) as User;
});
