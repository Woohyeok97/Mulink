// components
import Link from 'next/link';
import { Button } from '@/shared/ui/button/button';
import { MyLessonRequestView } from '@/features/lesson-request/ui/MyLessonRequestView';
// api
import { getMyLessonRequest } from '@/entities/lesson-request/lesson-request.api';

export default async function MyLessonRequestPage() {
  const myLessonRequest = await getMyLessonRequest();
  // const myLessonRequest = null;

  // 신청한 레슨이 없는 경우
  if (!myLessonRequest) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <p className="text-lg font-semibold text-(--neutral-700)">아직 신청한 레슨이 없어요</p>
          <p className="text-sm text-(--neutral-400)">코치를 찾고 있다면 레슨을 신청해 보세요.</p>

          <Link href="/student/lesson-request/new">
            <Button variant="default" className="cursor-pointer">
              레슨 신청하기
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* 코치 제안(offers)은 lesson-proposal 기능 구현 전까지 빈 배열 */}
      <MyLessonRequestView lesson={myLessonRequest} proposals={[]} />
    </div>
  );
}
