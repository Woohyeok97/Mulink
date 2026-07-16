import { toRelativeTime } from '@/shared/lib/relative-time';
import type { ChatMessage } from '@/entities/chat/chat.type';

type Props = { message: ChatMessage; isMine: boolean; readByPartner: boolean };

export function MessageBubble({ message, isMine, readByPartner }: Props) {
  return (
    <div className={isMine ? 'flex justify-end' : 'flex justify-start'}>
      <div className="max-w-[70%] rounded-lg bg-(--neutral-100) px-3 py-2">
        <p className="text-sm text-(--neutral-800)">{message.content}</p>
        <div className="mt-1 flex gap-1 text-xs text-(--neutral-400)">
          <span>{toRelativeTime(message.createdAt)}</span>
          {isMine && readByPartner && <span>읽음</span>}
        </div>
      </div>
    </div>
  );
}
