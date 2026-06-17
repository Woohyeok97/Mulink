'use client';

import { createClient } from '@/shared/lib/supabase/client';
import { Button } from '@/shared/ui/button';

export default function LoginPage() {
  const handleLogin = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  return (
    <main className="flex min-h-full items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6 rounded-lg border p-8">
        <h1 className="text-center text-xl font-semibold">MU:LINK 로그인</h1>
        <Button className="w-full" onClick={handleLogin}>
          카카오로 시작하기
        </Button>
      </div>
    </main>
  );
}
