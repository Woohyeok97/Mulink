import { create } from 'zustand';
import { io, type Socket } from 'socket.io-client';
import { createClient } from '@/shared/lib/supabase/client';
import type { ChatMessage } from '@/entities/chat/chat.type';
import { mergeMessages } from '../lib/merge-messages';

type ReadState = { readerId: string; lastReadMessageId: number };

type ChatSocketState = {
  socket: Socket | null;
  connected: boolean;
  messages: ChatMessage[]; // 현재 열려 있는 방의 메시지
  read: ReadState | null; // 상대의 읽음 위치(실시간)
  connect: () => Promise<void>;
  joinRoom: (roomId: string, initial: ChatMessage[]) => void;
  sendMessage: (roomId: string, content: string) => void;
  markRead: (roomId: string, lastReadMessageId: number) => void;
  disconnect: () => void;
};

// 랜덤 clientMsgId (미전송 큐 dedup·ack 매칭용) — 덩어리3에서 큐로 확장
function newClientMsgId(): string {
  return crypto.randomUUID();
}

export const useChatSocket = create<ChatSocketState>((set, get) => ({
  socket: null,
  connected: false,
  messages: [],
  read: null,

  // 소켓 1개 생성 + 핸드셰이크에 access_token 전달. 이미 있으면 재사용.
  connect: async () => {
    if (get().socket) return;
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;

    const socket = io(process.env.NEXT_PUBLIC_API_URL!, {
      auth: { token },
    });
    socket.on('connect', () => set({ connected: true }));
    socket.on('disconnect', () => set({ connected: false }));
    // 새 메시지 수신 → 중복 제거 병합
    socket.on('chat:message', (msg: ChatMessage) => {
      set({ messages: mergeMessages(get().messages, [msg]) });
    });
    // 상대 읽음 위치 → 실시간 읽음 표시용
    socket.on('chat:read', (r: ReadState) => set({ read: r }));

    set({ socket });
  },

  // 방 입장 + 초기 내역 세팅
  joinRoom: (roomId, initial) => {
    const { socket } = get();
    set({ messages: initial, read: null });
    socket?.emit('chat:join', { roomId });
  },

  // 전송 — clientMsgId 부여(덩어리3에서 미전송 큐로 확장)
  sendMessage: (roomId, content) => {
    const { socket } = get();
    socket?.emit('chat:send', { roomId, content, clientMsgId: newClientMsgId() });
  },

  // 읽음 알림
  markRead: (roomId, lastReadMessageId) => {
    get().socket?.emit('chat:read', { roomId, lastReadMessageId });
  },

  disconnect: () => {
    get().socket?.disconnect();
    set({ socket: null, connected: false, messages: [], read: null });
  },
}));
