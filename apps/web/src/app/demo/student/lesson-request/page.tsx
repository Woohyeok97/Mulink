import { DemoGuideDialog } from '../../_ui/DemoGuideDialog';
import { DemoMyLessonRequestView } from '../_ui/DemoMyLessonRequestView';

export default function DemoMyLessonRequestPage() {
  return (
    <div className="flex flex-1 flex-col">
      <DemoGuideDialog
        title="내 레슨 신청 현황을 확인하는 화면이에요"
        description={
          <>
            이 페이지에서는 내가 등록한 레슨 신청 내용과 코치님들의 레슨 제안들을 확인할 수 있어요.
            <br />
            마음에 드는 코치님의 프로필을 확인하고 채팅을 시작해보세요.
          </>
        }
        confirmText="확인"
      />
      <DemoMyLessonRequestView />
    </div>
  );
}
