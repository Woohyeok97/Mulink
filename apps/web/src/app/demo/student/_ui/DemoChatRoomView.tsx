'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Send } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar/avatar';
import { MessageBubble } from '@/features/chat/ui/MessageBubble';
import type { ChatMessage } from '@/entities/chat/chat.type';
// demo
import {
  DEMO_CHAT_PARTNER,
  DEMO_COACH_ID,
  DEMO_INITIAL_MESSAGES,
  DEMO_ME_ID,
  DEMO_REPLIES
} from '../_lib/demo-fixtures';
import { DemoSignupDialog } from './DemoSignupDialog';

// 코치 답장이 도착하기까지의 지연 — 실제로 상대가 입력하는 듯한 간격
const REPLY_DELAY_MS = 1200;
// 마지막 답장을 읽을 틈을 준 뒤 가입 모달을 띄우기까지의 지연
const SIGNUP_DELAY_MS = 800;

export function DemoChatRoomView() {
  const [messages, setMessages] = useState<ChatMessage[]>(DEMO_INITIAL_MESSAGES);
  const [typing, setTyping] = useState(false);
  const [signupOpen, setSignupOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // 다음에 내보낼 답장 위치. 렌더와 무관하므로 ref로 둔다.
  const replyIndex = useRef(0);
  // 답장을 기다리는 타이머들 — 화면을 벗어나면 취소한다
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // 새 메시지·입력중 표시가 바뀔 때마다 최신으로 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, typing]);

  // 답장이 도착하기 전에 나가면 예약된 타이머를 모두 취소
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  // 전송 핸들러 — 공백 무시.
  // form submit으로 받으면 한글 조합 중 Enter가 전송으로 새지 않는다(keydown은 샌다).
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const value = inputRef.current?.value.trim();
    if (!value) return;
    if (inputRef.current) inputRef.current.value = '';

    setMessages(prev => [...prev, createMessage(DEMO_ME_ID, value)]);

    // 준비된 답장을 다 썼으면 더 응답하지 않는다
    const reply = DEMO_REPLIES[replyIndex.current];
    if (!reply) return;

    const isLastReply = replyIndex.current === DEMO_REPLIES.length - 1;
    replyIndex.current += 1;

    setTyping(true);
    timers.current.push(
      setTimeout(() => {
        console.log('time!');
        setTyping(false);
        setMessages(prev => [...prev, createMessage(DEMO_COACH_ID, reply)]);
        // 마지막 답장까지 나갔으면 체험을 마무리하며 가입을 안내한다
        if (isLastReply) timers.current.push(setTimeout(() => setSignupOpen(true), SIGNUP_DELAY_MS));
      }, REPLY_DELAY_MS)
    );
  };

  return (
    <div className="flex h-full flex-col bg-white">
      {/* 헤더 — 뒤로가기 + 상대 프로필 */}
      <div className="flex shrink-0 items-center gap-3 border-b border-(--neutral-100) px-5 py-3 max-[640px]:px-3.5">
        <Link
          href="/demo/student/lesson-request"
          aria-label="제안 목록으로"
          className="flex size-9 items-center justify-center rounded-full text-(--neutral-600) transition-colors hover:bg-(--neutral-100)">
          <ChevronLeft className="size-5" />
        </Link>
        <Avatar size="sm">
          <AvatarImage src={DEMO_CHAT_PARTNER.imageUrl} alt={DEMO_CHAT_PARTNER.name} />
          <AvatarFallback>{DEMO_CHAT_PARTNER.name.charAt(0)}</AvatarFallback>
        </Avatar>
        <p className="truncate text-[15px] font-bold text-(--neutral-900)">{DEMO_CHAT_PARTNER.name}</p>
      </div>

      {/* 메시지 영역 */}
      <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-5 max-[640px]:p-3.5">
        {messages.map(message => (
          <MessageBubble
            key={message.id}
            message={message}
            isMine={message.senderId === DEMO_ME_ID}
            showUnread={false}
          />
        ))}
        {typing && <TypingBubble />}
        <div ref={bottomRef} />
      </div>

      {/* 입력창 */}
      <form
        onSubmit={handleSendMessage}
        className="flex shrink-0 items-center gap-2.5 border-t border-(--neutral-100) px-4.5 py-3.5 max-[640px]:px-3.5">
        <input
          ref={inputRef}
          className="flex-1 rounded-full border-[1.5px] border-(--neutral-200) bg-(--neutral-50) px-4.5 py-2.75 text-sm outline-none transition-colors focus:border-(--green-400) focus:bg-white"
          placeholder="메시지를 입력하세요"
        />
        <button
          type="submit"
          aria-label="전송"
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-(--green-800) text-white transition-colors hover:bg-(--green-700)">
          <Send className="size-4.5" />
        </button>
      </form>

      <DemoSignupDialog open={signupOpen} onClose={() => setSignupOpen(false)} />
    </div>
  );
}

// 코치가 답장을 준비하는 동안 보여주는 말풍선
function TypingBubble() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1 rounded-[18px] rounded-bl-lg bg-(--neutral-100) px-4 py-3.5">
        <span className="size-1.5 animate-bounce rounded-full bg-(--neutral-400)" />
        <span className="size-1.5 animate-bounce rounded-full bg-(--neutral-400) [animation-delay:150ms]" />
        <span className="size-1.5 animate-bounce rounded-full bg-(--neutral-400) [animation-delay:300ms]" />
      </div>
    </div>
  );
}

// 화면에만 존재하는 메시지 — id는 렌더 key 용도라 타임스탬프로 충분하다
function createMessage(senderId: string, content: string): ChatMessage {
  return {
    id: Date.now(),
    roomId: 'demo-room',
    senderId,
    content,
    createdAt: new Date().toISOString()
  };
}
