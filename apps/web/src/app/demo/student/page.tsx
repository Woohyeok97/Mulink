import { DemoGuideDialog } from '../_ui/DemoGuideDialog';
import { DemoLessonRequestForm } from './_ui/DemoLessonRequestForm';

export default function DemoLessonRequestPage() {
  return (
    <div className="flex flex-1 flex-col">
      <DemoGuideDialog
        title="레슨 신청서를 작성하는 화면이에요"
        description={
          <>
            원하는 지역, 선호하는 장르, 레슨을 통해 이루고 싶은 목표를 골라 레슨 신청서를 작성할 수 있어요.
            <br />
            이렇게 등록한 신청서를 보고 코치들이 먼저 레슨을 제안해와요.
          </>
        }
        confirmText="확인"
      />
      <DemoLessonRequestForm />
    </div>
  );
}
