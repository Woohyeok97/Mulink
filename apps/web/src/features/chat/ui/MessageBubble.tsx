import type { ChatMessage } from '@/entities/chat/chat.type';

interface MessageBubbleProps {
  message: ChatMessage;
  isMine: boolean;
  // 내 마지막 메시지이고 상대가 아직 안 읽었을 때만 '안읽음' 표시
  showUnread: boolean;
}

// ISO → '오후 2:03'
function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString('ko-KR', {
    hour: 'numeric',
    minute: '2-digit'
  });
}

export function MessageBubble({ message, isMine, showUnread }: MessageBubbleProps) {
  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[72%] flex-col ${isMine ? 'items-end' : 'items-start'}`}>
        <div
          className={`rounded-[18px] px-3.5 py-2.5 text-sm leading-normal wrap-break-word ${
            isMine
              ? 'rounded-br-lg bg-(--green-800) text-white'
              : 'rounded-bl-lg bg-(--neutral-100) text-(--neutral-900)'
          }`}>
          {message.content}
        </div>
        <div className="mt-1 flex items-center gap-1 text-[11px] text-(--neutral-400)">
          {isMine && showUnread && <span>안읽음</span>}
          <span>{formatClock(message.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}
