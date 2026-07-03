import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/entities/user/user.api';

export default async function CoachLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();

  // 비로그인 상태인 경우
  if (!user) {
    return redirect('/');
  }

  // 코치가 아닌 경우(학생/관리자)
  if (user.role !== 'COACH') {
    return redirect('/');
  }

  return children;
}
