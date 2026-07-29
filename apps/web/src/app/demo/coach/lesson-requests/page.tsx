import { DemoGuideDialog } from '../../_ui/DemoGuideDialog';
import { DEMO_OPEN_REQUESTS } from '../_lib/demo-fixtures';
import { DemoLessonRequestList } from '../_ui/DemoLessonRequestList';

export default function DemoCoachLessonRequestsPage() {
  return (
    <div className="mx-auto w-full max-w-260 px-4 pt-5 pb-15 sm:px-5 md:px-8 md:py-8 md:pb-16">
      <DemoGuideDialog
        title="학생들의 레슨 신청 목록을 보는 화면이에요"
        description={
          <>
            모집 중인 학생들의 레슨 신청을 둘러보고,
            <br />
            마음에 드는 신청에 한마디를 남겨 레슨을 제안해보세요.
          </>
        }
        confirmText="확인"
      />

      {/* 페이지 헤딩 */}
      <div className="mb-7">
        <div className="mb-1.5 flex items-baseline gap-2.5">
          <h1 className="text-2xl font-extrabold tracking-tight text-(--neutral-900)">레슨 신청 목록</h1>
          <span className="text-[15px] font-medium text-(--neutral-400)">{DEMO_OPEN_REQUESTS.length}개 모집 중</span>
        </div>
        <p className="text-sm leading-relaxed text-(--neutral-500)">코치님께 맞는 학생을 찾아 제안을 보내 보세요.</p>
      </div>

      <DemoLessonRequestList requests={DEMO_OPEN_REQUESTS} />
    </div>
  );
}
