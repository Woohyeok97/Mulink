import { create } from 'zustand';
import { io, type Socket } from 'socket.io-client';
import { createClient } from '@/shared/lib/supabase/client';
import type { ChatMessage } from '@/entities/chat/chat.type';
import { mergeMessages } from '../lib/merge-messages';
import { addPending, ackPending, type PendingMessage } from '../lib/send-queue';
import { fetchMessagesAfter } from '../lib/resync';

type ReadState = { readerId: string; lastReadMessageId: number };

// 서버 chat:message는 발신자 낙관 렌더분 제거를 위해 clientMsgId를 되실어 온다.
type IncomingMessage = ChatMessage & { clientMsgId?: string };

interface ChatSocketState {
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
}

// 방을 안 연 초기 상태(disconnect로도 되돌아감)
const emptyRoomState = {
  messages: [] as ChatMessage[],
  read: null as ReadState | null,
  currentRoomId: null as string | null,
  lastReceivedId: 0,
  pending: [] as PendingMessage[],
};

export const useChatSocket = create<ChatSocketState>((set, get) => {
  // 커서 이후 메시지를 조회해 병합하고 커서를 올린다(멱등). 재연결 직후 재동기화용.
  const resync = (roomId: string) => {
    void fetchMessagesAfter(roomId, get().lastReceivedId).then((rows) => {
      if (rows.length === 0) return;
      set((state) => ({
        messages: mergeMessages(state.messages, rows),
        lastReceivedId: Math.max(state.lastReceivedId, ...rows.map((row) => row.id)),
      }));
    });
  };

  return {
    socket: null,
    connected: false,
    ...emptyRoomState,

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
        const { currentRoomId, pending } = get();
        if (!currentRoomId) return;

        socket.emit('chat:join', { roomId: currentRoomId });

        // 미전송 재전송 (clientMsgId 유지 → 서버가 되실어 중복 제거)
        for (const message of pending) {
          socket.emit('chat:send', message);
        }

        // 마지막 수신 id 초과분을 DB에서 조회해 병합(소켓이 못 밀어준 구간 복구)
        resync(currentRoomId);
      });

      socket.on('disconnect', () => set({ connected: false }));

      // 새 메시지: 병합 + 커서 갱신 + (내가 보낸 것이면) clientMsgId로 큐에서 제거.
      // 발신자도 이 이벤트로 자기 메시지를 받으므로 별도 ack 없이 여기서 확정한다.
      socket.on('chat:message', (message: IncomingMessage) => {
        set((state) => ({
          messages: mergeMessages(state.messages, [message]),
          lastReceivedId: Math.max(state.lastReceivedId, message.id),
          pending: message.clientMsgId
            ? ackPending(state.pending, message.clientMsgId)
            : state.pending,
        }));
      });

      // 상대 읽음 위치 → 실시간 읽음 표시용
      socket.on('chat:read', (read: ReadState) => set({ read }));

      set({ socket });
    },

    // 방 입장 + 초기 내역 세팅 + 커서 초기화
    joinRoom: (roomId, initial) => {
      set({
        ...emptyRoomState,
        messages: initial,
        currentRoomId: roomId,
        lastReceivedId: initial.at(-1)?.id ?? 0,
      });
      get().socket?.emit('chat:join', { roomId });
    },

    // 전송: 큐에 추가(낙관) 후 emit. 끊겨 있으면 emit은 버려지고 재연결 시 큐가 재전송.
    sendMessage: (roomId, content) => {
      const message: PendingMessage = {
        clientMsgId: crypto.randomUUID(),
        roomId,
        content,
      };
      set((state) => ({ pending: addPending(state.pending, message) }));
      get().socket?.emit('chat:send', message);
    },

    // 읽음 알림
    markRead: (roomId, lastReadMessageId) => {
      get().socket?.emit('chat:read', { roomId, lastReadMessageId });
    },

    disconnect: () => {
      get().socket?.disconnect();
      set({ socket: null, connected: false, ...emptyRoomState });
    },
  };
});
