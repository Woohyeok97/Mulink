import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/entities/user/user.api';

export default async function ChatLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  if (!user) return redirect('/'); // 채팅은 학생·코치 공용, 로그인만 가드
  return children;
}
