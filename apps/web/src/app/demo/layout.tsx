import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/entities/user/user.api';

interface DemoLayoutProps {
  children: React.ReactNode;
}

export default async function DemoLayout({ children }: Readonly<DemoLayoutProps>) {
  const user = await getCurrentUser();

  // 로그인한 사용자는 메인으로 돌려보냄
  if (user) {
    return redirect('/');
  }

  return children;
}
