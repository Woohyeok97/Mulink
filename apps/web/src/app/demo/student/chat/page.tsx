import { DemoChatRoomView } from '../_ui/DemoChatRoomView';
import { DemoGuideDialog } from '../_ui/DemoGuideDialog';

export default function DemoChatPage() {
  return (
    <main className="mx-auto flex h-[calc(100dvh-3.5rem)] w-full max-w-180 flex-col">
      <DemoGuideDialog
        title="코치와 대화해보세요"
        description="메시지를 보내면 코치가 답장을 보내와요. 실제 서비스에서는 실시간으로 대화할 수 있어요."
        confirmText="대화 시작하기"
      />
      <DemoChatRoomView />
    </main>
  );
}
