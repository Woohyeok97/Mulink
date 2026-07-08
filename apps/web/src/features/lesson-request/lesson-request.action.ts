'use server';

import { createClient } from '@/shared/lib/supabase/server';

// 나의 레슨 신청을 삭제(취소)한다. 성공하면 void, 실패하면 { error }.
export async function deleteLessonRequestAction(id: string): Promise<{ error: string } | void> {
  const supabase = await createClient();
  // Bearer 토큰을 백엔드에 넘겨야 하는 구조상 getSession() 사용 (검증은 백엔드 Guard)
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    return { error: '로그인이 필요합니다.' };
  }

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/lesson-requests/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    return { error: body.message ?? '신청 취소에 실패했습니다.' };
  }

  // 성공: 호출한 클라이언트가 router.refresh()로 목록을 갱신한다
}
