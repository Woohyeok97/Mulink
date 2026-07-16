import Link from 'next/link';
import { toRelativeTime } from '@/shared/lib/relative-time';
import type { ChatRoomSummary } from '@/entities/chat/chat.type';

export function ChatRoomList({ rooms }: { rooms: ChatRoomSummary[] }) {
  if (rooms.length === 0) {
    return (
      <p className="p-6 text-center text-sm text-(--neutral-400)">
        참여 중인 채팅방이 없습니다
      </p>
    );
  }
  return (
    <ul className="divide-y divide-(--neutral-100)">
      {rooms.map((room) => (
        <li key={room.id}>
          <Link href={`/chat/${room.id}`} className="flex items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-(--neutral-800)">
                {room.partner.name}
              </p>
              <p className="truncate text-xs text-(--neutral-400)">
                {room.lastMessage?.content ?? '대화 없음'}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              {room.lastMessage && (
                <span className="text-xs text-(--neutral-400)">
                  {toRelativeTime(room.lastMessage.createdAt)}
                </span>
              )}
              {room.unreadCount > 0 && (
                <span className="rounded-full bg-(--green-600) px-1.5 text-xs text-white">
                  {room.unreadCount}
                </span>
              )}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
