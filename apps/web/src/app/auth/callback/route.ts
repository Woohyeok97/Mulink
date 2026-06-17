import { NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.session) {
      // 첫 로그인 시 NestJS에 User 동기화 (프론트는 DB 직접 접근 안 함)
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      });
      return NextResponse.redirect(`${origin}/`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
