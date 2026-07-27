import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar/avatar';
import { toRelativeTime } from '@/shared/lib/relative-time';
import type { ChatRoomSummary } from '@/entities/chat/chat.type';

export function ChatRoomList({ rooms }: { rooms: ChatRoomSummary[] }) {
  if (rooms.length === 0) return <EmptyState />;

  return (
    <div className="flex flex-col gap-2">
      {rooms.map(room => (
        <ChatRoomRow key={room.id} room={room} />
      ))}
    </div>
  );
}

// 채팅방 한 줄 — 안 읽음이면 배경·이름·시각을 강조하고 아바타에 링을 두른다
function ChatRoomRow({ room }: { room: ChatRoomSummary }) {
  const isUnread = room.unreadCount > 0;

  return (
    <Link
      href={`/chat/${room.id}`}
      className={`flex items-center gap-3.5 rounded-lg border bg-white p-3 transition-shadow duration-150 hover:shadow-md ${
        isUnread ? 'border-(--green-300) bg-(--green-50)' : 'border-(--neutral-200)'
      }`}>
      <Avatar
        size="default"
        className={isUnread ? 'shadow-[0_0_0_2px_var(--green-400),0_0_0_5px_var(--green-100)]' : ''}>
        <AvatarImage src={room.partner.imageUrl ?? undefined} alt={room.partner.name} />
        <AvatarFallback>{room.partner.name.charAt(0)}</AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm ${isUnread ? 'font-extrabold text-(--neutral-900)' : 'font-semibold text-(--neutral-800)'}`}>
          {room.partner.name}
        </p>
        <p
          className={`mt-0.5 truncate text-[13px] ${isUnread ? 'font-medium text-(--neutral-600)' : 'text-(--neutral-400)'}`}>
          {room.lastMessage?.content ?? '대화 없음'}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1.5">
        {room.lastMessage && (
          <span
            className={`font-mono text-xs ${isUnread ? 'font-semibold text-(--green-700)' : 'text-(--neutral-400)'}`}>
            {toRelativeTime(room.lastMessage.createdAt)}
          </span>
        )}
        {isUnread && (
          <span className="flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-(--green-600) px-1.5 font-mono text-[11px] font-bold text-white">
            {room.unreadCount > 99 ? '99+' : room.unreadCount}
          </span>
        )}
      </div>
    </Link>
  );
}

// 참여 중인 방이 없을 때
function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-20 text-center">
      <div className="flex size-18 items-center justify-center rounded-full bg-(--green-50) text-(--green-300)">
        <MessageSquare className="size-8" />
      </div>
      <div>
        <p className="mb-1.5 text-base font-bold text-(--neutral-800)">아직 채팅방이 없어요</p>
        <p className="text-sm leading-normal text-(--neutral-500)">레슨 제안에서 코치와 채팅을 시작해 보세요</p>
      </div>
    </div>
  );
}
