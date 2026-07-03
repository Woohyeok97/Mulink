import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/entities/user/user.api';

export default async function StudentLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();

  // 비로그인 상태인 경우
  if (!user) {
    return redirect('/');
  }

  // 학생이 아닌 경우(코치/관리자)
  if (user.role !== 'STUDENT') {
    return redirect('/');
  }

  return children;
}
