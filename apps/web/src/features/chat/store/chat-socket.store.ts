import { create } from 'zustand';
import { io, type Socket } from 'socket.io-client';
import { createClient } from '@/shared/lib/supabase/client';
import type { ChatMessage } from '@/entities/chat/chat.type';
import { mergeMessages } from '../lib/merge-messages';
import { addPending, ackPending, type PendingMessage } from '../lib/send-queue';
import { fetchMessagesAfter } from '../lib/resync';

type ReadState = { readerId: string; lastReadMessageId: number };

type ChatSocketState = {
  socket: Socket | null;
  connected: boolean;
  messages: ChatMessage[]; // 현재 열려 있는 방의 메시지
  read: ReadState | null; // 상대의 읽음 위치(실시간)
  currentRoomId: string | null; // 재연결 시 재동기화 대상
  lastReceivedId: number; // 재동기화 커서(마지막으로 받은 서버 id)
  pending: PendingMessage[]; // 미ack 메시지(재전송용)
  connect: () => Promise<void>;
  joinRoom: (roomId: string, initial: ChatMessage[]) => void;
  sendMessage: (roomId: string, content: string) => void;
  markRead: (roomId: string, lastReadMessageId: number) => void;
  disconnect: () => void;
};

// 랜덤 clientMsgId (미전송 큐 dedup·ack 매칭용)
function newClientMsgId(): string {
  return crypto.randomUUID();
}

export const useChatSocket = create<ChatSocketState>((set, get) => ({
  socket: null,
  connected: false,
  messages: [],
  read: null,
  currentRoomId: null,
  lastReceivedId: 0,
  pending: [],

  // 소켓 1개 생성 + 핸드셰이크에 access_token 전달. 이미 있으면 재사용.
  connect: async () => {
    if (get().socket) return;
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;

    // 재연결 폭풍 완화: 지수 백오프(1s→5s) + 지터(0.5)로 동시 재접속 분산 (SPEC 8.2)
    const socket = io(process.env.NEXT_PUBLIC_API_URL!, {
      auth: { token },
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
    });

    // 연결/재연결 시: 방 재입장 → 미ack 큐 재전송 → 끊긴 사이 메시지 재동기화
    socket.on('connect', () => {
      set({ connected: true });
      const { currentRoomId, pending, lastReceivedId } = get();
      if (!currentRoomId) return;

      socket.emit('chat:join', { roomId: currentRoomId });

      // ③ 미전송 재전송 (clientMsgId 유지 → 서버가 되실어 중복 제거)
      for (const m of pending) {
        socket.emit('chat:send', {
          roomId: m.roomId,
          content: m.content,
          clientMsgId: m.clientMsgId,
        });
      }

      // ② 재동기화: 마지막 수신 id 초과분을 DB에서 조회해 병합
      void fetchMessagesAfter(currentRoomId, lastReceivedId).then((rows) => {
        if (rows.length === 0) return;
        const merged = mergeMessages(get().messages, rows);
        const maxId = Math.max(get().lastReceivedId, ...rows.map((r) => r.id));
        set({ messages: merged, lastReceivedId: maxId });
      });
    });

    socket.on('disconnect', () => set({ connected: false }));

    // 새 메시지: 병합 + 커서 갱신 + (내가 보낸 것이면) 큐에서 제거
    socket.on('chat:message', (msg: ChatMessage & { clientMsgId?: string }) => {
      const merged = mergeMessages(get().messages, [msg]);
      const nextPending = msg.clientMsgId
        ? ackPending(get().pending, msg.clientMsgId)
        : get().pending;
      set({
        messages: merged,
        lastReceivedId: Math.max(get().lastReceivedId, msg.id),
        pending: nextPending,
      });
    });

    // ack: 미전송 큐에서 확정 제거
    socket.on(
      'chat:ack',
      ({ clientMsgId }: { clientMsgId: string; id: number }) => {
        set({ pending: ackPending(get().pending, clientMsgId) });
      },
    );

    // 상대 읽음 위치 → 실시간 읽음 표시용
    socket.on('chat:read', (r: ReadState) => set({ read: r }));

    set({ socket });
  },

  // 방 입장 + 초기 내역 세팅 + 커서 초기화
  joinRoom: (roomId, initial) => {
    const { socket } = get();
    const lastId = initial.length ? initial[initial.length - 1].id : 0;
    set({
      messages: initial,
      read: null,
      currentRoomId: roomId,
      lastReceivedId: lastId,
      pending: [],
    });
    socket?.emit('chat:join', { roomId });
  },

  // 전송: 큐에 추가(낙관) 후 emit. 끊겨 있으면 emit은 버려지고 재연결 시 큐가 재전송.
  sendMessage: (roomId, content) => {
    const { socket } = get();
    const clientMsgId = newClientMsgId();
    set({
      pending: addPending(get().pending, { clientMsgId, roomId, content }),
    });
    socket?.emit('chat:send', { roomId, content, clientMsgId });
  },

  // 읽음 알림
  markRead: (roomId, lastReadMessageId) => {
    get().socket?.emit('chat:read', { roomId, lastReadMessageId });
  },

  disconnect: () => {
    get().socket?.disconnect();
    set({
      socket: null,
      connected: false,
      messages: [],
      read: null,
      currentRoomId: null,
      lastReceivedId: 0,
      pending: [],
    });
  },
}));
