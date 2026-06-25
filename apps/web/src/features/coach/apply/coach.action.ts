'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/shared/lib/supabase/server';
import type { CoachApplyFormValues } from './coachApplySchema';

export async function registerCoachAction(data: CoachApplyFormValues): Promise<{ error: string } | void> {
  const supabase = await createClient();
  // getSession은 쿠키 기반 세션을 그대로 읽으며 서버 재검증 없음.
  // Bearer 토큰을 백엔드에 전달해야 하는 구조상 getUser() 대신 사용.
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  if (!token) {
    return { error: '로그인이 필요합니다.' };
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

  const res = await fetch(`${apiUrl}/coaches`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { error: body.message ?? '코치 가입에 실패했습니다.' };
  }

  redirect('/');
}
