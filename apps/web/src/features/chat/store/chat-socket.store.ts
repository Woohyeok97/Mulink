import { create } from 'zustand';
import { io, type Socket } from 'socket.io-client';
import { createClient } from '@/shared/lib/supabase/client';
import type { ChatMessage } from '@/entities/chat/chat.type';
import { mergeMessages } from '../lib/merge-messages';
import { fetchMessagesAfter } from '../lib/resync';

// 상대가 어디까지 읽었는지 (내 메시지 옆 '읽음' 표시에 사용)
type ReadState = { readerId: string; lastReadMessageId: number };

// 서버가 내려주는 메시지. sendMessageKey는 서버 upsert가 재전송 중복 저장을 막는 데 쓰는 표(멱등 키)다.
type IncomingMessage = ChatMessage & { sendMessageKey?: string };

interface ChatSocketState {
  socket: Socket | null; // 서버로 가는 연결선 (로그인한 나 = 1개, 방과 무관)
  connected: boolean; // 지금 연결돼 있나 (끊기면 false → '재연결 중' 표시)
  messages: ChatMessage[]; // 지금 열어둔 방의 메시지 목록
  read: ReadState | null; // 상대의 읽음 위치
  currentRoomId: string | null; // 지금 열어둔 방 (끊겼다 붙을 때 어느 방을 되살릴지)
  connectRoom: (roomId: string, initial: ChatMessage[]) => Promise<void>;
  sendMessage: (roomId: string, content: string) => void;
  markRead: (roomId: string, lastReadMessageId: number) => void;
  disconnect: () => void;
}

// 아직 아무 방도 안 연 상태. 스토어는 앱에 하나뿐이라 시작·방 전환·종료 때 이 값으로 비운다.
const emptyRoomState = {
  messages: [] as ChatMessage[],
  read: null as ReadState | null,
  currentRoomId: null as string | null,
};

export const useChatSocket = create<ChatSocketState>((set, get) => {
  // 끊긴 사이 놓친 메시지 되찾기: 지금 목록의 마지막 번호 다음부터를 서버(DB)에서 조회해 합친다.
  // 이미 가진 메시지와 겹쳐도 번호로 중복을 걸러내므로 여러 번 불러도 안전하다.
  const fetchMissedMessages = async (roomId: string) => {
    const lastReceivedId = get().messages.at(-1)?.id ?? 0;
    const rows = await fetchMessagesAfter(roomId, lastReceivedId);
    if (rows.length === 0) return;
    set((state) => ({ messages: mergeMessages(state.messages, rows) }));
  };

  return {
    socket: null,
    connected: false,
    ...emptyRoomState,

    // 방에 들어간다. 방 정보를 세팅하고, 연결이 없으면 새로 만든다.
    // 실제 방 입장(chat:join)은 아래 'connect' 이벤트 안에서 보내므로
    // "연결이 끝난 뒤에 입장"이 자동으로 보장된다(호출부에서 순서를 신경 쓸 필요 없음).
    connectRoom: async (roomId, initial) => {
      // 새 방 정보로 교체 (이전 방 값이 안 남게 나머지는 빈 값으로 리셋)
      set({
        ...emptyRoomState,
        messages: initial,
        currentRoomId: roomId,
      });

      // 이미 소켓 있으면(다른 방에서 넘어옴) 새로 만들지 않고 방만 바꿈
      const existing = get().socket;
      if (existing) {
        existing.emit('chat:join', { roomId });
        return;
      }

      // 로그인 토큰을 꺼내 연결선에 실어 보낸다. 없으면(비로그인) 연결하지 않는다.
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
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
        const { currentRoomId } = get();
        if (!currentRoomId) return;

        socket.emit('chat:join', { roomId: currentRoomId });

        // 끊긴 사이 상대가 보낸(내가 못 받은) 메시지를 서버에서 되찾아 채운다.
        void fetchMissedMessages(currentRoomId);
      });

      // 끊기면 표시만 바꾼다 (socket.io가 알아서 재접속을 시도한다)
      socket.on('disconnect', () => set({ connected: false }));

      // 새 메시지가 오면 목록에 합친다.
      socket.on('chat:message', (message: IncomingMessage) => {
        set((state) => ({
          messages: mergeMessages(state.messages, [message]),
        }));
      });

      // 상대가 읽은 위치가 오면 저장 (내 메시지 옆 '읽음'을 실시간 갱신)
      socket.on('chat:read', (read: ReadState) => set({ read }));

      set({ socket });
    },

    // 메시지 전송. sendMessageKey(고유 표)를 붙여 보내면 끊김 중 socket.io 버퍼가
    // 재전송하더라도 서버 upsert가 같은 표로 중복 저장을 막는다.
    sendMessage: (roomId, content) => {
      get().socket?.emit('chat:send', { sendMessageKey: crypto.randomUUID(), roomId, content });
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
