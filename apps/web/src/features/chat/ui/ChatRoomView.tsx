'use client';

import { useEffect, useRef } from 'react';
import { useChatSocket } from '../store/chat-socket.store';
import { MessageBubble } from './MessageBubble';
import { ConnectionStatus } from './ConnectionStatus';
import type { ChatMessage } from '@/entities/chat/chat.type';

type Props = { roomId: string; myId: string; initialMessages: ChatMessage[] };

export function ChatRoomView({ roomId, myId, initialMessages }: Props) {
  const {
    connected,
    messages,
    read,
    pending,
    connect,
    joinRoom,
    sendMessage,
    markRead,
  } = useChatSocket();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 마운트: 소켓 연결 후 방 입장 + 초기 내역 세팅
  useEffect(() => {
    let cancelled = false;
    void connect().then(() => {
      if (!cancelled) joinRoom(roomId, initialMessages);
    });
    return () => {
      cancelled = true;
    };
    // roomId 바뀌면 재입장 (connect/joinRoom은 store 액션이라 안정적)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // 새 메시지 도착·진입 시 최신으로 스크롤 + 읽음 처리
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
    const last = messages.at(-1);
    if (last) markRead(roomId, last.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, roomId]);

  // 전송 핸들러 — 공백 무시
  const handleSend = () => {
    const value = inputRef.current?.value.trim();
    if (!value) return;
    sendMessage(roomId, value);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="flex h-full flex-col">
      <ConnectionStatus connected={connected} />
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-(--neutral-400)">
            대화를 시작해보세요
          </p>
        ) : (
          messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              isMine={m.senderId === myId}
              readByPartner={
                read !== null &&
                read.readerId !== myId &&
                read.lastReadMessageId >= m.id
              }
            />
          ))
        )}
        {/* 아직 서버 ack를 못 받은 미전송 메시지 — 흐리게 '전송 중' 표시 */}
        {pending.map((p) => (
          <div key={p.clientMsgId} className="flex justify-end opacity-50">
            <div className="max-w-[70%] rounded-lg bg-(--neutral-100) px-3 py-2">
              <p className="text-sm text-(--neutral-800)">{p.content}</p>
              <span className="text-xs text-(--neutral-400)">전송 중…</span>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2 border-t border-(--neutral-100) p-3">
        <input
          ref={inputRef}
          className="flex-1 rounded-md border border-(--neutral-200) px-3 py-2 text-sm"
          placeholder="메시지 입력"
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSend();
          }}
        />
        <button
          className="rounded-md bg-(--green-600) px-4 text-sm text-white"
          onClick={handleSend}>
          전송
        </button>
      </div>
    </div>
  );
}
