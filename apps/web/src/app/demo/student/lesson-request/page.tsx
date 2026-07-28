import { DemoGuideDialog } from '../_ui/DemoGuideDialog';
import { DemoMyLessonRequestView } from '../_ui/DemoMyLessonRequestView';

export default function DemoMyLessonRequestPage() {
  return (
    <div className="flex flex-1 flex-col">
      <DemoGuideDialog
        title="코치 제안이 도착했어요"
        description="신청서를 본 코치들이 제안을 보내왔어요. 프로필 보기를 눌러 코치를 확인하고 채팅을 시작해보세요."
        confirmText="제안 확인하기"
      />
      <DemoMyLessonRequestView />
    </div>
  );
}
