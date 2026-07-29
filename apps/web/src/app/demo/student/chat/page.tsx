import { DemoChatRoomView } from '../../_ui/DemoChatRoomView';
import { DemoGuideDialog } from '../../_ui/DemoGuideDialog';
import { DEMO_CHAT_PARTNER, DEMO_INITIAL_MESSAGES, DEMO_REPLIES } from '../_lib/demo-fixtures';

export default function DemoChatPage() {
  return (
    <main className="mx-auto flex h-[calc(100dvh-3.5rem)] w-full max-w-180 flex-col">
      <DemoGuideDialog
        title="코치와 1:1로 채팅하는 화면이에요"
        description={
          <>
            코치에게 궁금한 점을 물어보거나 레슨 일정을 상담할 수 있어요.
            <br />
            메시지를 입력해 전송하면 실시간으로 대화를 이어갈 수 있어요.
          </>
        }
        confirmText="확인"
      />
      <DemoChatRoomView
        backHref="/demo/student/lesson-request"
        partner={DEMO_CHAT_PARTNER}
        initialMessages={DEMO_INITIAL_MESSAGES}
        replies={DEMO_REPLIES}
      />
    </main>
  );
}
