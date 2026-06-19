'use client';

import { Button } from '@/shared/ui/button';

export default function LoginPage() {
  // 카카오 인증은 NestJS가 직접 처리한다. 버튼을 누르면 NestJS의 로그인 진입점으로
  // 이동하고, 거기서 카카오 동의 화면으로 redirect 된다.
  const handleLogin = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/auth/kakao/login`;
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
