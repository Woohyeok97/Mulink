'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/shared/lib/supabase/server';
import type { CoachRegisterFormType } from './coach-register.schema';

export async function coachRegisterAction(data: CoachRegisterFormType): Promise<{ error: string } | void> {
  const supabase = await createClient();
  // getSession은 쿠키 기반 세션을 그대로 읽으며 서버 재검증 없음
  // Bearer 토큰을 백엔드에 전달해야 하는 구조상 getUser() 대신 사용
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    return { error: '로그인이 필요합니다.' };
  }

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/coaches`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    return { error: body.message ?? '코치 가입에 실패했습니다.' };
  }

  redirect('/');
}
