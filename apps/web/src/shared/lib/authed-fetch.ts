import 'server-only';
import { createClient } from '@/shared/lib/supabase/server';

// 서버 컴포넌트·서버 액션용: 쿠키 세션의 access_token을 Authorization에 실어 백엔드 호출.
// 토큰이 없으면(비로그인) null, 그 외에는 fetch 응답을 그대로 반환한다.
// 응답 성공/실패·본문 파싱은 도메인마다 반환값이 달라 호출부가 처리한다.
export async function authedFetch(
  path: string,
  init?: RequestInit,
): Promise<Response | null> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return null;

  return fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${token}` },
  });
}
