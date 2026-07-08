'use server';

import { createClient } from '@/shared/lib/supabase/server';
import type { LessonRegisterFormType } from './lesson-register.schema';

export async function lessonRegisterAction(data: LessonRegisterFormType): Promise<{ error: string } | void> {
  const supabase = await createClient();
  // getSession은 쿠키 기반 세션을 그대로 읽으며 서버 재검증 없음
  // Bearer 토큰을 백엔드에 전달해야 하는 구조상 getUser() 대신 사용
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    return { error: '로그인이 필요합니다.' };
  }

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/lesson-requests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    return { error: body.message ?? '레슨 신청에 실패했습니다.' };
  }

  // 성공: redirect 없이 반환 → 클라이언트가 SuccessView로 전환
}
