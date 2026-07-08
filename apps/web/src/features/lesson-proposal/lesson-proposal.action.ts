'use server';

import { createClient } from '@/shared/lib/supabase/server';

// 레슨 신청(requestId)에 제안 메시지를 보낸다. 성공하면 void, 실패하면 { error }.
export async function createLessonProposalAction(requestId: string, message: string): Promise<{ error: string } | void> {
  const supabase = await createClient();
  // Bearer 토큰을 백엔드에 넘겨야 하는 구조상 getSession() 사용 (검증은 백엔드 Guard)
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    return { error: '로그인이 필요합니다.' };
  }

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/lesson-requests/${requestId}/lesson-proposals`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ message }),
    },
  );

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    return { error: body.message ?? '제안 전송에 실패했습니다.' };
  }

  // 성공: 호출한 클라이언트가 router.refresh()로 목록을 갱신한다
}

// 보낸 레슨 제안을 취소한다. 성공하면 void, 실패하면 { error }.
export async function deleteLessonProposalAction(proposalId: string): Promise<{ error: string } | void> {
  const supabase = await createClient();
  // Bearer 토큰을 백엔드에 넘겨야 하는 구조상 getSession() 사용 (검증은 백엔드 Guard)
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    return { error: '로그인이 필요합니다.' };
  }

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/lesson-proposals/${proposalId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    return { error: body.message ?? '제안 취소에 실패했습니다.' };
  }

  // 성공: 호출한 클라이언트가 router.refresh()로 목록을 갱신한다
}
