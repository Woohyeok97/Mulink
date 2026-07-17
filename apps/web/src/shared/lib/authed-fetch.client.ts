import { createClient } from '@/shared/lib/supabase/client';

// 브라우저(클라이언트 컴포넌트·스토어)용: 세션의 access_token을 실어 백엔드 호출.
// 토큰이 없으면(비로그인) null, 그 외에는 fetch 응답을 그대로 반환한다.
export async function authedFetchClient(
  path: string,
  init?: RequestInit,
): Promise<Response | null> {
  const supabase = createClient();
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
