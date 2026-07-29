'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { ChevronLeft, Send, MessageSquare, RefreshCw } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar/avatar';
import { useChatSocket } from '../store/chat-socket.store';
import { MessageBubble } from './MessageBubble';
import type { ChatMessage } from '@/entities/chat/chat.type';

interface ChatRoomViewProps {
  roomId: string;
  myId: string;
  partner: { name: string; imageUrl: string | null };
  initialMessages: ChatMessage[];
}

export function ChatRoomView({ roomId, myId, partner, initialMessages }: ChatRoomViewProps) {
  const { connected, messages, read, connectRoom, sendMessage, markRead } = useChatSocket();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 마운트·방 전환 시 연결 + 방 입장 (connectRoom이 연결 완료 후 입장까지 처리)
  useEffect(() => {
    void connectRoom(roomId, initialMessages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // 새 메시지 도착·진입 시 최신으로 스크롤 + 읽음 처리
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
    const last = messages.at(-1);
    if (last) markRead(roomId, last.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, roomId]);

  // 전송 핸들러 — 공백 무시.
  // form submit으로 받으면 한글 조합 중 Enter가 전송으로 새지 않는다(keydown은 샌다).
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const value = inputRef.current?.value.trim();
    if (!value) return;
    sendMessage(roomId, value);
    if (inputRef.current) inputRef.current.value = '';
  };

  // 내가 보낸 마지막 메시지 id — 그 메시지에만 '안읽음'을 붙이려고 미리 구한다
  const lastMineId = messages.reduce((acc, m) => (m.senderId === myId ? m.id : acc), -1);
  // 상대가 내 마지막 메시지를 아직 안 읽었는지
  const partnerHasNotRead = read === null || read.readerId === myId || read.lastReadMessageId < lastMineId;

  return (
    <div className="flex h-full flex-col bg-white">
      {/* 헤더 — 뒤로가기 + 상대 프로필 */}
      <div className="flex shrink-0 items-center gap-3 border-b border-(--neutral-100) px-5 py-3 max-[640px]:px-3.5">
        <Link
          href="/chat"
          aria-label="목록으로"
          className="flex size-9 items-center justify-center rounded-full text-(--neutral-600) transition-colors hover:bg-(--neutral-100)">
          <ChevronLeft className="size-5" />
        </Link>
        <Avatar size="sm">
          <AvatarImage src={partner.imageUrl ?? undefined} alt={partner.name} />
          <AvatarFallback>{partner.name.charAt(0)}</AvatarFallback>
        </Avatar>
        <p className="truncate text-[15px] font-bold text-(--neutral-900)">{partner.name}</p>
      </div>

      {/* 재연결 배너 */}
      {!connected && (
        <div className="flex shrink-0 items-center justify-center gap-2 bg-(--warning-100) py-2.5 text-[13px] font-medium text-(--warning-700)">
          <RefreshCw className="size-3.5" />
          연결이 끊겨 재연결 중이에요…
        </div>
      )}

      {/* 메시지 영역 */}
      {messages.length === 0 ? (
        <EmptyConversation partner={partner} />
      ) : (
        <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-5 max-[640px]:p-3.5">
          {messages.map(message => (
            <MessageBubble
              key={message.id}
              message={message}
              isMine={message.senderId === myId}
              showUnread={message.id === lastMineId && partnerHasNotRead}
            />
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      {/* 입력창 */}
      <form
        onSubmit={handleSendMessage}
        className="flex shrink-0 items-center gap-2.5 border-t border-(--neutral-100) px-4.5 py-3.5 max-[640px]:px-3.5">
        <input
          ref={inputRef}
          className="flex-1 rounded-full border-[1.5px] border-(--neutral-200) bg-(--neutral-50) px-4.5 py-2.75 text-base outline-none transition-colors focus:border-(--green-400) focus:bg-white sm:text-sm"
          placeholder="메시지를 입력하세요"
        />
        <button
          type="submit"
          aria-label="전송"
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-(--green-800) text-white transition-colors hover:bg-(--green-700)">
          <Send className="size-4.5" />
        </button>
      </form>
    </div>
  );
}

// 아직 메시지가 없는 방 — 안내 + 상대 프로필 카드
function EmptyConversation({ partner }: { partner: { name: string; imageUrl: string | null } }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 p-10 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-(--green-50) text-(--green-300)">
        <MessageSquare className="size-7" />
      </div>
      <div>
        <p className="mb-1.5 text-base font-bold text-(--neutral-800)">대화를 시작해보세요</p>
        <p className="text-[13px] text-(--neutral-500)">{partner.name}님과의 첫 메시지를 보내보세요</p>
      </div>
      <div className="flex w-full max-w-70 items-center gap-3 rounded-[14px] border border-(--neutral-200) bg-(--neutral-50) px-4.5 py-3.5">
        <Avatar size="default">
          <AvatarImage src={partner.imageUrl ?? undefined} alt={partner.name} />
          <AvatarFallback>{partner.name.charAt(0)}</AvatarFallback>
        </Avatar>
        <p className="text-sm font-bold text-(--neutral-900)">{partner.name}</p>
      </div>
    </div>
  );
}
