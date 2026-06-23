import { NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code'); // 임시용 세션 코드를 쿼리 파라미터에서 추출

  if (code) {
    // 1) 세션 코드로 NestJS에서 세션 토큰을 받아옴 (서버 ↔ 서버)
    const getSessionTokenResponse = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/auth/session/exchange`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      },
    );

    if (!getSessionTokenResponse.ok) {
      // 세션 코드가 만료되었거나 이미 사용된 경우
      return NextResponse.redirect(`${origin}/login?error=expired`);
    }

    const { accessToken, refreshToken } = (await getSessionTokenResponse.json()) as {
      accessToken: string;
      refreshToken: string;
    };

    // 2) 받은 토큰을 ssr 쿠키 세션에 심는다
    const supabase = await createClient();
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) {
      // Supabase 세션 토큰 주입 실패 (토큰이 유효하지 않거나 Supabase 오류)
      return NextResponse.redirect(`${origin}/login?error=session`);
    }

    // 3) 첫 로그인 시 public.User 동기화 (기존 패턴 그대로)
    const upsertUserResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (upsertUserResponse.ok) {
      return NextResponse.redirect(`${origin}/`);
    }

    // supabase DB public.User 동기화 실패 (DB upsert 오류)
    return NextResponse.redirect(`${origin}/login?error=sync`);
  }

  // 쿼리 파라미터에 세션 code가 없는 경우 (정상적인 OAuth 흐름이 아님)
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
