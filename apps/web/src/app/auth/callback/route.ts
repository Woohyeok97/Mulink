import { NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const ticket = searchParams.get('ticket');

  if (ticket) {
    // 1) ticket으로 NestJS에서 세션 토큰을 받아온다 (서버↔서버).
    const exchangeRes = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/auth/session/exchange`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket }),
      },
    );
    if (!exchangeRes.ok) {
      return NextResponse.redirect(`${origin}/login?error=expired`);
    }
    const { accessToken, refreshToken } = (await exchangeRes.json()) as {
      accessToken: string;
      refreshToken: string;
    };

    // 2) 받은 토큰을 ssr 쿠키 세션에 심는다.
    const supabase = await createClient();
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) {
      return NextResponse.redirect(`${origin}/login?error=session`);
    }

    // 3) 첫 로그인 시 public.User 동기화 (기존 패턴 그대로).
    const syncRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/sync`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (syncRes.ok) {
      return NextResponse.redirect(`${origin}/`);
    }
    return NextResponse.redirect(`${origin}/login?error=sync`);
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
