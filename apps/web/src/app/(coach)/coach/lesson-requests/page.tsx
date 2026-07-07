import { getOpenLessonRequests } from '@/entities/lesson-request/lesson-request.api';
import { LessonRequestList } from '@/features/lesson-proposal/ui/LessonRequestList';

export default async function CoachLessonRequestsPage() {
  const requests = await getOpenLessonRequests();

  return (
    <div className="mx-auto w-full max-w-260 px-4 pt-5 pb-15 sm:px-5 md:px-8 md:py-8 md:pb-16">
      {/* 페이지 헤딩 */}
      <div className="mb-7">
        <div className="mb-1.5 flex items-baseline gap-2.5">
          <h1 className="text-2xl font-extrabold tracking-tight text-(--neutral-900)">레슨 신청 목록</h1>
          {requests.length > 0 && (
            <span className="text-[15px] font-medium text-(--neutral-400)">{requests.length}개 모집 중</span>
          )}
        </div>
        <p className="text-sm leading-relaxed text-(--neutral-500)">
          코치님께 맞는 학생을 찾아 제안을 보내 보세요.
        </p>
      </div>

      <LessonRequestList requests={requests} />
    </div>
  );
}
