import { redirect } from 'next/navigation';
import { EmptyApplication } from '@/features/lesson-me/ui/EmptyApplication';
import { LessonMeView } from '@/features/lesson-me/ui/LessonMeView';
import { getCurrentUser } from '@/entities/user/user.api';
import { getMyLessonRequest, getMyLessonOffers } from '@/entities/lesson-request/lesson-request.api';

export default async function LessonMePage() {
  const user = await getCurrentUser();

  // 비로그인 상태인 경우
  if (!user) {
    return redirect('/');
  }

  // 학생이 아닌 경우(코치/관리자)
  if (user.role !== 'STUDENT') {
    return redirect('/');
  }

  const request = await getMyLessonRequest();

  // 신청한 레슨이 없는 경우
  if (!request) {
    return (
      <div className="flex flex-1 flex-col">
        <EmptyApplication />
      </div>
    );
  }

  const offers = await getMyLessonOffers();

  return (
    <div className="flex flex-1 flex-col">
      <LessonMeView request={request} offers={offers} />
    </div>
  );
}
