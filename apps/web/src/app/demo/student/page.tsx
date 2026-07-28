import { DemoGuideDialog } from './_ui/DemoGuideDialog';
import { DemoLessonRequestForm } from './_ui/DemoLessonRequestForm';

export default function DemoLessonRequestPage() {
  return (
    <div className="flex flex-1 flex-col">
      <DemoGuideDialog
        title="학생 체험을 시작할게요"
        description="신청서 작성 → 코치 제안 확인 → 채팅까지 직접 둘러보실 수 있어요. 로그인 없이 진행되고, 입력한 내용은 저장되지 않아요."
        confirmText="신청서 작성해보기"
      />
      <DemoLessonRequestForm />
    </div>
  );
}
