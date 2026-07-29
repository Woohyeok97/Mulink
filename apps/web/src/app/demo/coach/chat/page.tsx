import { DemoChatRoomView } from '../../_ui/DemoChatRoomView';
import { DemoGuideDialog } from '../../_ui/DemoGuideDialog';
import { DEMO_CHAT_PARTNER, DEMO_INITIAL_MESSAGES, DEMO_REPLIES } from '../_lib/demo-fixtures';

export default function DemoCoachChatPage() {
  return (
    <main className="mx-auto flex h-[calc(100dvh-3.5rem)] w-full max-w-180 flex-col">
      <DemoGuideDialog
        title="학생과 1:1로 채팅하는 화면이에요"
        description={
          <>
            상담을 요청한 학생과 궁금한 점이나 레슨 일정을 이야기할 수 있어요.
            <br />
            메시지를 입력해 전송하면 실시간으로 대화를 이어갈 수 있어요.
          </>
        }
        confirmText="확인"
      />
      <DemoChatRoomView
        backHref="/demo/coach/lesson-requests"
        partner={DEMO_CHAT_PARTNER}
        initialMessages={DEMO_INITIAL_MESSAGES}
        replies={DEMO_REPLIES}
      />
    </main>
  );
}
