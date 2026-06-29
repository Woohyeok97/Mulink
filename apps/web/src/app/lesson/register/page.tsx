import { redirect } from 'next/navigation';
import { LessonRegisterForm } from '@/features/lesson-register/ui/LessonRegisterForm';
import { getCurrentUser } from '@/entities/user/user.api';

export default async function LessonRegisterPage() {
  const user = await getCurrentUser();

  // 비로그인 상태인 경우
  if (!user) {
    return redirect('/');
  }

  // 학생이 아닌 경우(코치/관리자)
  if (user.role !== 'STUDENT') {
    return redirect('/');
  }

  return <LessonRegisterForm />;
}
