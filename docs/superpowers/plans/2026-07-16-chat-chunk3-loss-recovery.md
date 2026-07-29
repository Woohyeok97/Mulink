# 유실 3구멍 해결 (덩어리 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 서버 재배포로 소켓이 끊긴 구간의 메시지 유실(해결 전 재현 조건 유실률 3.3%)을 0으로 만든다 — 재연결 폭풍 완화(백오프+지터), 마지막 수신 ID 재동기화, 미전송 재전송 큐.

**Architecture:** 세 해결책 모두 **프론트 중심**(재동기화 조회 API `?after=`는 덩어리 1에서 이미 구현됨). Zustand 소켓 스토어(`chat-socket.store.ts`)를 확장한다. 로직의 핵심(재전송 큐 관리·낙관적 병합)은 순수 함수로 떼어 Vitest로 검증하고, 스토어는 그 함수를 소켓 이벤트에 연결하는 얇은 층으로 둔다.

**Tech Stack:** socket.io-client v4(재연결 옵션 내장), zustand v5, Vitest. 백엔드 변경 없음.

**설계 근거:** `docs/SPEC.md` 8.2~8.4, `docs/superpowers/specs/2026-07-16-chat-message-loss-recovery-design.md` 덩어리 3, `docs/private/records/6-chat.md`(해결 전 수치·재현 조건).

**전제(덩어리 1·2 완료 상태):**
- `chat-socket.store.ts`: `socket/connected/messages/read` + `connect/joinRoom/sendMessage/markRead/disconnect`. `sendMessage`는 `clientMsgId`만 붙이고 큐 없음. `newClientMsgId()` 존재.
- 서버 `chat:message`에 `clientMsgId` 되실림, `chat:ack{clientMsgId,id}` 발신자에게 보냄(게이트웨이 확인됨).
- `getRoomMessagesAfter` 미사용 상태로 `entities/chat/chat.api.ts`에 있는지 확인 필요 — 없으면 추가(덩어리 1 B1에서 `getRoomMessages`만 만들었을 수 있음).
- 측정: `apps/api/scripts/repro-chat-loss.mjs` (조건 박제). 재측정은 이 스크립트 그대로.

**작업 규칙:**
- 커밋 자주. 프론트 코드 작성 전 `vercel-react-best-practices`·`frontend-code-style` 참고.
- 측정은 Docker 재빌드 필요(스크립트는 컨테이너 대상). 단 이번 변경은 **프론트만**이라
  서버 이미지 재빌드는 불필요 — 측정 스크립트는 헤드리스 소켓 클라이언트라 서버 로직만
  쓴다. **주의**: 측정 스크립트에는 재전송 큐·재동기화가 없으므로, 스크립트에도 동일 로직을
  넣어야 "해결 후" 수치가 나온다(Task 5에서 스크립트 확장).

---

## 파일 구조

- Modify: `apps/web/src/features/chat/store/chat-socket.store.ts` — 재연결 옵션·재동기화·큐 연결
- Create: `apps/web/src/features/chat/lib/send-queue.ts` — 미전송 큐 순수 함수
- Create: `apps/web/src/features/chat/lib/send-queue.test.ts`
- Modify: `apps/web/src/entities/chat/chat.api.ts` — `getRoomMessagesAfter`(없으면 추가) + 클라이언트 재동기화 fetch 함수
- Modify: `apps/api/scripts/repro-chat-loss.mjs` — 측정 클라이언트에 재동기화·재전송 큐 반영

---

## Task 1: 미전송 큐 순수 함수 + 테스트

**Files:**
- Create: `apps/web/src/features/chat/lib/send-queue.ts`
- Test: `apps/web/src/features/chat/lib/send-queue.test.ts`

> 큐는 "보냈지만 아직 ack 못 받은 메시지" 목록. 추가(전송 시)·제거(ack 시)·조회(재연결 재전송)를
> 순수 함수로. clientMsgId가 키.

- [ ] **Step 1: 실패 테스트 작성**

`send-queue.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { addPending, ackPending, type PendingMessage } from './send-queue';

const item = (id: string): PendingMessage => ({
  clientMsgId: id,
  roomId: 'r',
  content: `c-${id}`,
});

describe('send-queue', () => {
  // 전송 시 큐에 추가
  it('addPending은 항목을 큐 끝에 추가한다', () => {
    const q = addPending([], item('a'));
    expect(q.map((m) => m.clientMsgId)).toEqual(['a']);
  });

  // ack 받으면 해당 clientMsgId 제거
  it('ackPending은 해당 clientMsgId를 제거한다', () => {
    const q = addPending(addPending([], item('a')), item('b'));
    const after = ackPending(q, 'a');
    expect(after.map((m) => m.clientMsgId)).toEqual(['b']);
  });

  // 없는 id ack는 큐 그대로
  it('없는 id ack는 큐를 바꾸지 않는다', () => {
    const q = addPending([], item('a'));
    expect(ackPending(q, 'zzz')).toEqual(q);
  });

  // 같은 clientMsgId 중복 추가 방지(재전송 dedup)
  it('같은 clientMsgId는 중복 추가하지 않는다', () => {
    const q = addPending(addPending([], item('a')), item('a'));
    expect(q).toHaveLength(1);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter=@mulink/web test -- send-queue`
Expected: FAIL (`send-queue` 없음)

- [ ] **Step 3: 구현**

`send-queue.ts`:
```ts
// 미전송(미ack) 메시지 큐. clientMsgId를 키로 추가·제거하는 순수 함수 모음.
// 연결이 끊긴 채 보낸 메시지를 재연결 시 재전송하기 위해 보관한다.
export type PendingMessage = {
  clientMsgId: string;
  roomId: string;
  content: string;
};

// 큐 끝에 추가 (같은 clientMsgId가 이미 있으면 그대로 — 재전송 dedup)
export function addPending(
  queue: PendingMessage[],
  item: PendingMessage,
): PendingMessage[] {
  if (queue.some((m) => m.clientMsgId === item.clientMsgId)) return queue;
  return [...queue, item];
}

// ack 받은 clientMsgId 제거 (없으면 동일 배열 참조 유지)
export function ackPending(
  queue: PendingMessage[],
  clientMsgId: string,
): PendingMessage[] {
  if (!queue.some((m) => m.clientMsgId === clientMsgId)) return queue;
  return queue.filter((m) => m.clientMsgId !== clientMsgId);
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter=@mulink/web test -- send-queue`
Expected: PASS (4 tests)

- [ ] **Step 5: 커밋**

```bash
git add apps/web/src/features/chat/lib/send-queue.ts apps/web/src/features/chat/lib/send-queue.test.ts
git commit -m "feat(chat): 미전송 재전송 큐 순수 함수 + 테스트"
```

---

## Task 2: 재동기화 클라이언트 조회 함수

**Files:**
- Modify: `apps/web/src/entities/chat/chat.api.ts`

> 재연결 직후 "마지막 수신 id 초과" 메시지를 조회하는 함수. 기존 SSR 조회(`getRoomMessages`)는
> `server-only`라 클라이언트(스토어)에서 못 쓴다. 스토어에서 쓸 **클라이언트 fetch** 함수를
> 별도로 둔다(브라우저 supabase로 토큰 획득).

- [ ] **Step 1: 현재 chat.api.ts 확인**

Run: `grep -n "getRoomMessagesAfter\|server-only\|export const" apps/web/src/entities/chat/chat.api.ts`
`getRoomMessagesAfter`가 있으면 server-only라 클라에서 못 씀을 확인(아래 클라 전용 함수를 별도 파일에 둠).

- [ ] **Step 2: 클라이언트 재동기화 함수 작성 (별도 파일)**

`server-only` 오염을 피하려 features 쪽에 클라 전용 파일로 둔다.
Create: `apps/web/src/features/chat/lib/resync.ts`
```ts
import { createClient } from '@/shared/lib/supabase/client';
import type { ChatMessage } from '@/entities/chat/chat.type';

// 재연결 직후 호출: 마지막으로 받은 id 초과 메시지만 조회(끊긴 사이 쌓인 것).
// 브라우저에서 실행되므로 browser supabase로 토큰을 얻는다. 실패 시 빈 배열.
export async function fetchMessagesAfter(
  roomId: string,
  afterId: number,
): Promise<ChatMessage[]> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return [];

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/chat-rooms/${roomId}/messages?after=${afterId}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return [];
  return (await res.json()) as ChatMessage[];
}
```

- [ ] **Step 3: 타입체크**

Run: `pnpm --filter=@mulink/web check-types`
Expected: 성공

- [ ] **Step 4: 커밋**

```bash
git add apps/web/src/features/chat/lib/resync.ts
git commit -m "feat(chat): 재연결 재동기화용 클라이언트 조회 함수"
```

---

## Task 3: 스토어 확장 — 재연결 튜닝 + 재동기화 + 큐

**Files:**
- Modify: `apps/web/src/features/chat/store/chat-socket.store.ts`

- [ ] **Step 1: 스토어 전체 교체**

세 해결을 스토어에 연결. 변경점:
1. `io()`에 **백오프+지터 옵션**.
2. `currentRoomId`·`lastReceivedId` 상태 추가(재연결 시 어느 방을 어디부터 재동기화할지).
3. `chat:message` 수신 시 `lastReceivedId` 갱신 + **내 ack면 큐에서 제거**(clientMsgId).
4. `chat:ack` 수신 시 큐에서 제거.
5. `connect`(재연결 포함) 시 `pending` 큐 **재전송** + `?after=` **재동기화 병합**.
6. `sendMessage`는 큐에 추가(낙관) 후 emit.

`chat-socket.store.ts` 전체:
```ts
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
  messages: ChatMessage[];
  read: ReadState | null;
  currentRoomId: string | null; // 재연결 시 재동기화 대상
  lastReceivedId: number; // 재동기화 커서(마지막으로 받은 서버 id)
  pending: PendingMessage[]; // 미ack 메시지(재전송용)
  connect: () => Promise<void>;
  joinRoom: (roomId: string, initial: ChatMessage[]) => void;
  sendMessage: (roomId: string, content: string) => void;
  markRead: (roomId: string, lastReadMessageId: number) => void;
  disconnect: () => void;
};

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

  connect: async () => {
    if (get().socket) return;
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
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
    socket.on('chat:ack', ({ clientMsgId }: { clientMsgId: string; id: number }) => {
      set({ pending: ackPending(get().pending, clientMsgId) });
    });

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
    set({ pending: addPending(get().pending, { clientMsgId, roomId, content }) });
    socket?.emit('chat:send', { roomId, content, clientMsgId });
  },

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
```

- [ ] **Step 2: 타입체크 + 기존 테스트**

Run: `pnpm --filter=@mulink/web check-types && pnpm --filter=@mulink/web test`
Expected: 성공 (기존 53 + send-queue 4)

- [ ] **Step 3: 빌드**

Run: `pnpm --filter=@mulink/web build`
Expected: 성공

- [ ] **Step 4: 커밋**

```bash
git add apps/web/src/features/chat/store/chat-socket.store.ts
git commit -m "feat(chat): 재연결 튜닝 + 마지막ID 재동기화 + 미전송 재전송 큐"
```

---

## Task 4: ChatRoomView 큐 낙관 렌더 (pending 메시지 표시)

**Files:**
- Modify: `apps/web/src/features/chat/ui/ChatRoomView.tsx`

> 큐에 있는(아직 서버 id 없는) 메시지를 화면에 pending으로 보여줘야 사용자가 "보냈다"고 인지.
> 최소 뼈대 수준으로만(시안 오면 교체). 큐 항목을 messages 아래에 흐릿하게 덧붙인다.

- [ ] **Step 1: pending 표시 추가**

`ChatRoomView.tsx`에서 스토어의 `pending`을 구독해, 확정 메시지 목록 아래에 아직 미ack인
큐 항목을 흐리게 렌더. (이미 서버로부터 `chat:message`로 돌아온 것은 clientMsgId로 큐에서
빠지므로 중복 표시 안 됨.)

`useChatSocket()` 구조분해에 `pending` 추가:
```tsx
  const { connected, messages, read, pending, connect, joinRoom, sendMessage, markRead } =
    useChatSocket();
```

메시지 목록 렌더 뒤(`<div ref={bottomRef} />` 앞)에 pending 추가:
```tsx
        {pending.map((p) => (
          <div key={p.clientMsgId} className="flex justify-end opacity-50">
            <div className="max-w-[70%] rounded-lg bg-(--neutral-100) px-3 py-2">
              <p className="text-sm text-(--neutral-800)">{p.content}</p>
              <span className="text-xs text-(--neutral-400)">전송 중…</span>
            </div>
          </div>
        ))}
```

- [ ] **Step 2: 타입체크 + 빌드**

Run: `pnpm --filter=@mulink/web check-types && pnpm --filter=@mulink/web build`
Expected: 성공

- [ ] **Step 3: 커밋**

```bash
git add apps/web/src/features/chat/ui/ChatRoomView.tsx
git commit -m "feat(chat): 미전송 큐 낙관 렌더(전송 중 표시)"
```

---

## Task 5: 측정 스크립트에 해결 로직 반영

**Files:**
- Modify: `apps/api/scripts/repro-chat-loss.mjs`

> 측정 스크립트의 헤드리스 클라이언트는 스토어를 안 쓰므로, **동일한 해결 로직**(재연결 옵션 +
> 재연결 시 `?after=` 재동기화 + 미전송 재전송 큐)을 스크립트에도 넣어야 "해결 후" 수치가
> 나온다. 없으면 스크립트는 여전히 유실을 보고한다(스크립트≠앱).

- [ ] **Step 1: makeClient에 재연결 옵션·큐·재동기화 추가**

`io(API, { auth: { token } })` → 재연결 옵션 추가:
```js
  const socket = io(API, {
    auth: { token },
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    randomizationFactor: 0.5,
  });
```

클라이언트 상태에 `pending`(미ack)·`lastReceivedId`·`token`·`roomId` 보유. 수정된 `makeClient`:
```js
function makeClient(label, token, roomId) {
  const socket = io(API, {
    auth: { token },
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    randomizationFactor: 0.5,
  });
  const sent = new Set();
  const received = new Set();
  const pending = new Map(); // clientMsgId → {content}
  let seq = 0;
  let lastReceivedId = 0;

  socket.on('connect', async () => {
    socket.emit('chat:join', { roomId });
    // ③ 미전송 재전송
    for (const [clientMsgId, m] of pending) {
      socket.emit('chat:send', { roomId, content: m.content, clientMsgId });
    }
    // ② 재동기화: 마지막 수신 id 초과분 조회 후 상대 메시지 집계에 반영
    try {
      const res = await fetch(`${API}/chat-rooms/${roomId}/messages?after=${lastReceivedId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const rows = await res.json();
        for (const msg of rows) {
          if (msg.id > lastReceivedId) lastReceivedId = msg.id;
          const x = /^\[(\w+)#(\d+)\]/.exec(msg.content);
          if (x && x[1] !== label) received.add(Number(x[2]));
        }
      }
    } catch {
      // 재동기화 실패는 다음 재연결에서 재시도
    }
  });

  socket.on('chat:message', (msg) => {
    if (msg.id > lastReceivedId) lastReceivedId = msg.id;
    if (msg.clientMsgId) pending.delete(msg.clientMsgId);
    const x = /^\[(\w+)#(\d+)\]/.exec(msg.content);
    if (x && x[1] !== label) received.add(Number(x[2]));
  });
  socket.on('chat:ack', ({ clientMsgId }) => pending.delete(clientMsgId));

  return {
    label,
    send() {
      seq += 1;
      sent.add(seq);
      const clientMsgId = `${label}-${seq}`;
      pending.set(clientMsgId, { content: `[${label}#${seq}]` });
      socket.emit('chat:send', { roomId, content: `[${label}#${seq}]`, clientMsgId });
    },
    stats: () => ({ sent, received }),
    close: () => socket.close(),
    isConnected: () => socket.connected,
  };
}
```

> 주의: 재동기화가 상대 메시지를 `received`에 병합하므로, 끊긴 사이 온 메시지도 집계됨 →
> 유실 0. 자기 pending은 재전송돼 서버 저장 → 상대가 재동기화로 받음.

- [ ] **Step 2: 종료 전 대기 시간 확대**

재전송·재동기화가 마지막 재시작(13초) 후에도 일어나므로, 측정 종료 후 정리 대기를
넉넉히(현재 1500ms → 3000ms):
```js
  await sleep(3000); // 마지막 인플라이트·재동기화 정리 대기
```

- [ ] **Step 3: 커밋 (측정은 Task 6에서)**

```bash
git add apps/api/scripts/repro-chat-loss.mjs
git commit -m "test(chat): 측정 스크립트에 재연결·재동기화·재전송 큐 반영(해결 후 측정용)"
```

---

## Task 6: 해결 후 재측정 + 문서 갱신

**Files:**
- Modify: `docs/private/records/6-chat.md` (gitignore — 로컬)
- Modify: `docs/private/RESUME_PLAN.md`·`RESUME_STEP.md` (gitignore — 로컬)

- [ ] **Step 1: 컨테이너 최신 확인**

이번 변경은 프론트·스크립트만이라 서버 이미지 재빌드 불필요. 단 컨테이너가 development로
떠 있어야 함:
Run: `docker exec mulink-api-1 printenv NODE_ENV` → `development` 확인. 아니면 재기동.

- [ ] **Step 2: 동일 조건 재측정 (해결 후)**

Run: `for i in 1 2 3; do echo "=== $i ==="; node apps/api/scripts/repro-chat-loss.mjs 2>&1 | grep -E "합계|→"; done`
Expected: **유실률 0.0%** (3회 일관). 만약 유실이 남으면 재동기화/큐 타이밍 디버깅
(마지막 재시작 후 대기 시간 부족이 흔한 원인 → Task 5 Step 2 대기 확대).

- [ ] **Step 3: records 갱신**

`6-chat.md`의 "5. 해결"·"6. 해결 후 수치"를 채운다: 세 구멍 각 해결 방식(파일·핵심 로직),
해결 후 3회 측정 표(유실률 0%), 전후 비교("재현 조건에서 3.3% → 0%").

- [ ] **Step 4: RESUME 갱신**

`RESUME_STEP.md` 6단계 해결 체크박스(해결 1·2·3·재측정) 완료 표시.
`RESUME_PLAN.md` FE-2 예시 불릿 수치를 실측값으로: "재현 조건 메시지 유실률 3.3% → 0%".

- [ ] **Step 5: 최종 그린 확인**

Run: `pnpm --filter=@mulink/web test && pnpm --filter=@mulink/web check-types && pnpm --filter=@mulink/api test`
Expected: 전부 통과.

---

## Self-Review 결과

- **스펙 커버리지**: SPEC 8.2 재연결 폭풍(백오프+지터) → Task 3 `io()` 옵션. 8.3 재동기화 →
  Task 2 `fetchMessagesAfter` + Task 3 `connect` 재동기화. 8.4 미전송 큐 → Task 1 순수함수 +
  Task 3 연결 + Task 4 낙관 렌더. 측정 → Task 5·6.
- **플레이스홀더**: 없음. 모든 코드 스텝에 실제 코드.
- **타입 일관성**: `PendingMessage{clientMsgId,roomId,content}`가 send-queue↔store↔스크립트에서
  일치. `addPending/ackPending` 시그니처 Task1↔Task3 일치. `fetchMessagesAfter(roomId,afterId)`
  Task2↔Task3 일치. `lastReceivedId`·`currentRoomId`·`pending` 스토어 상태 일관.
- **주의점**: 측정 스크립트에도 해결 로직을 넣어야 함(Task 5) — 앱만 고치면 스크립트는 계속
  유실 보고. Self-review에서 이 함정을 Task로 명시함.
