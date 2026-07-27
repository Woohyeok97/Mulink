'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/shared/lib/supabase/server';
import type { CoachRegisterFormType } from './coach-register.schema';

// 로그인 세션의 액세스 토큰을 꺼낸다 (Bearer로 백엔드에 전달할 용도)
// getSession은 쿠키 기반 세션을 그대로 읽으며 서버 재검증 없음 — getUser() 대신 사용
async function getAccessToken(): Promise<string | null> {
  const supabase = await createClient();
  const { data: sessionData } = await supabase.auth.getSession();
  return sessionData.session?.access_token ?? null;
}

// 프로필 이미지 업로드용 presigned URL 발급 요청
export async function getUploadUrlAction(contentType: string): Promise<{ uploadUrl: string; publicUrl: string } | { error: string }> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { error: '로그인이 필요합니다.' };
  }

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/coach-profiles/upload-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ contentType }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    return { error: body.message ?? '이미지 업로드 준비에 실패했습니다.' };
  }

  return response.json();
}

export async function coachRegisterAction(data: CoachRegisterFormType): Promise<{ error: string } | void> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return { error: '로그인이 필요합니다.' };
  }

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/coach-profiles`, {
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
