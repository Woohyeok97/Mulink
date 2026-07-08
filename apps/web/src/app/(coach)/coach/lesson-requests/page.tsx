import { FileText } from 'lucide-react';
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
        <p className="text-sm leading-relaxed text-(--neutral-500)">코치님께 맞는 학생을 찾아 제안을 보내 보세요.</p>
      </div>

      {requests.length === 0 ? (
        <div className="flex flex-col items-center gap-5 rounded-2xl border border-(--neutral-200) bg-white px-6 py-20 text-center">
          <div className="flex size-20 items-center justify-center rounded-full bg-(--green-50) text-(--green-300)">
            <FileText size={38} />
          </div>
          <div>
            <p className="mb-2 text-[17px] font-bold text-(--neutral-800)">아직 모집 중인 레슨 신청이 없어요</p>
            <p className="text-sm leading-relaxed break-keep text-(--neutral-500)">
              학생들이 새 레슨 신청을 올리면 여기에 나타나요.
            </p>
          </div>
        </div>
      ) : (
        <LessonRequestList requests={requests} />
      )}
    </div>
  );
}
