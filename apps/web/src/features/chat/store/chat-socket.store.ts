import { create } from 'zustand';
import { io, type Socket } from 'socket.io-client';
import { createClient } from '@/shared/lib/supabase/client';
import type { ChatMessage } from '@/entities/chat/chat.type';
import { mergeMessages } from '../lib/merge-messages';
import { addPending, ackPending, type PendingMessage } from '../lib/send-queue';
import { fetchMessagesAfter } from '../lib/resync';

// 상대가 어디까지 읽었는지 (내 메시지 옆 '읽음' 표시에 사용)
type ReadState = { readerId: string; lastReadMessageId: number };

// 서버가 내려주는 메시지. 내가 보낸 게 돌아올 땐 clientMsgId(임시 표)가 함께 실려 온다
// → 그 표를 보고 '전송 중' 목록에서 뺀다.
type IncomingMessage = ChatMessage & { clientMsgId?: string };

interface ChatSocketState {
  socket: Socket | null; // 서버로 가는 연결선 (로그인한 나 = 1개, 방과 무관)
  connected: boolean; // 지금 연결돼 있나 (끊기면 false → '재연결 중' 표시)
  messages: ChatMessage[]; // 지금 열어둔 방의 메시지 목록
  read: ReadState | null; // 상대의 읽음 위치
  currentRoomId: string | null; // 지금 열어둔 방 (끊겼다 붙을 때 어느 방을 되살릴지)
  lastReceivedId: number; // 마지막으로 받은 메시지 번호 ('이 번호 다음부터 다시 줘'의 기준)
  pending: PendingMessage[]; // 보냈지만 아직 서버 확인이 안 된 메시지 ('전송 중')
  connect: (roomId: string, initial: ChatMessage[]) => Promise<void>;
  sendMessage: (roomId: string, content: string) => void;
  markRead: (roomId: string, lastReadMessageId: number) => void;
  disconnect: () => void;
}

// 아직 아무 방도 안 연 상태. 스토어는 앱에 하나뿐이라 시작·방 전환·종료 때 이 값으로 비운다.
const emptyRoomState = {
  messages: [] as ChatMessage[],
  read: null as ReadState | null,
  currentRoomId: null as string | null,
  lastReceivedId: 0,
  pending: [] as PendingMessage[],
};

export const useChatSocket = create<ChatSocketState>((set, get) => {
  // 끊긴 사이 놓친 메시지 되찾기: 마지막으로 받은 번호 다음부터를 서버(DB)에서 조회해 목록에 합친다.
  // 이미 가진 메시지와 겹쳐도 번호로 중복을 걸러내므로 여러 번 불러도 안전하다.
  const resyncMissedMessages = (roomId: string) => {
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

    // 방에 들어간다. 방 정보를 세팅하고, 연결이 없으면 새로 만든다.
    // 실제 방 입장(chat:join)은 아래 'connect' 이벤트 안에서 보내므로
    // "연결이 끝난 뒤에 입장"이 자동으로 보장된다(호출부에서 순서를 신경 쓸 필요 없음).
    connect: async (roomId, initial) => {
      // 새 방 정보로 교체 (이전 방 값이 안 남게 나머지는 빈 값으로 리셋)
      set({
        ...emptyRoomState,
        messages: initial,
        currentRoomId: roomId,
        lastReceivedId: initial.at(-1)?.id ?? 0,
      });

      // 이미 연결선이 있으면(다른 방에서 넘어옴) 새로 만들지 않고 방만 바꾼다.
      const existing = get().socket;
      if (existing) {
        existing.emit('chat:join', { roomId });
        return;
      }

      // 로그인 토큰을 꺼내 연결선에 실어 보낸다. 없으면(비로그인) 연결하지 않는다.
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;

      // 연결이 끊기면 socket.io가 자동으로 다시 붙는데, 그 재접속이 한꺼번에 몰려
      // 서버를 또 덮치지 않도록 간격을 두고(1s→5s) 시점을 흩뿌린다(SPEC 8.2).
      const socket = io(process.env.NEXT_PUBLIC_API_URL!, {
        auth: { token },
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        randomizationFactor: 0.5,
      });

      // 연결 성공 시(첫 연결·재연결 모두): 방에 입장하고, 끊긴 사이 밀린 것들을 만회한다.
      socket.on('connect', () => {
        set({ connected: true });
        const { currentRoomId, pending } = get();
        if (!currentRoomId) return;

        socket.emit('chat:join', { roomId: currentRoomId });

        // 끊긴 사이 내가 보낸(아직 전송 중인) 메시지를 다시 보낸다.
        // 같은 표(clientMsgId)를 유지하므로 서버가 중복 저장하지 않는다.
        for (const message of pending) {
          socket.emit('chat:send', message);
        }

        // 끊긴 사이 상대가 보낸(내가 못 받은) 메시지를 서버에서 되찾아 채운다.
        resyncMissedMessages(currentRoomId);
      });

      // 끊기면 표시만 바꾼다 (socket.io가 알아서 재접속을 시도한다)
      socket.on('disconnect', () => set({ connected: false }));

      // 새 메시지가 오면: 목록에 합치고, 받은 번호를 기록하고,
      // 그게 내가 보낸 것이면(clientMsgId 있음) '전송 중' 목록에서 뺀다.
      socket.on('chat:message', (message: IncomingMessage) => {
        set((state) => ({
          messages: mergeMessages(state.messages, [message]),
          lastReceivedId: Math.max(state.lastReceivedId, message.id),
          pending: message.clientMsgId
            ? ackPending(state.pending, message.clientMsgId)
            : state.pending,
        }));
      });

      // 상대가 읽은 위치가 오면 저장 (내 메시지 옆 '읽음'을 실시간 갱신)
      socket.on('chat:read', (read: ReadState) => set({ read }));

      set({ socket });
    },

    // 메시지 전송: 화면에 바로 '전송 중'으로 띄우고(먼저 목록에 넣음) 서버로 보낸다.
    // 끊겨 있으면 이 보내기는 버려지지만, 목록에 남아 있어 재연결 때 다시 보내진다.
    sendMessage: (roomId, content) => {
      const message: PendingMessage = {
        clientMsgId: crypto.randomUUID(), // 이 메시지를 알아볼 임시 표
        roomId,
        content,
      };
      set((state) => ({ pending: addPending(state.pending, message) }));
      get().socket?.emit('chat:send', message);
    },

    // '여기까지 읽었다'를 서버에 알린다
    markRead: (roomId, lastReadMessageId) => {
      get().socket?.emit('chat:read', { roomId, lastReadMessageId });
    },

    // 연결을 완전히 끊고 상태를 비운다 (예: 로그아웃 시)
    disconnect: () => {
      get().socket?.disconnect();
      set({ socket: null, connected: false, ...emptyRoomState });
    },
  };
});
