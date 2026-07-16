# FE-2. 1:1 실시간 채팅 + 서버 재시작 메시지 유실 해결

## Context

MU:LINK에 학생-코치 1:1 실시간 채팅을 신규 구현한다. 이 작업의 **진짜 목적은
포트폴리오 재료**다(RESUME_PLAN.md FE-2, RESUME_STEP.md 6단계). 채팅 기능 자체는
이력서에 넣지 않고, 그 위에서 "서버 재배포로 소켓이 끊긴 몇 초 사이 상대가 보낸
메시지가 유실되는" 장애를 **재현 → 기술로 해결 → 전후 수치로 증명**하는 것이
산출물이다. 따라서 코드만큼 **재현·측정 스크립트와 전후 수치 기록**이 중요하다.

재배포 한 상황에서 터지는 세 구멍을 각각 막는다:
- **② 메시지 유실 (창끝)**: 끊긴 사이 상대가 보낸 메시지는 DB엔 저장됐지만 소켓
  push를 놓쳐 재연결돼도 화면에 안 뜬다. → **마지막 수신 ID 기반 재동기화**로 해결.
- **① 재연결 폭풍 (서브)**: 재배포 시 전체 클라이언트가 동시 재접속해 서버 재타격.
  → socket.io 내장 **백오프 + 지터** 튜닝.
- **③ 미전송 (서브)**: 보내는 순간 소켓이 끊겨 서버 도달조차 못 한 메시지.
  → 프론트 **재전송 큐**.

현재 채팅은 백엔드·프론트 **코드 0줄, 패키지 미설치**. 단 스키마·REST·소켓 이벤트·
프론트 배치는 `docs/SPEC.md`(2·4·5·8장)에 상세히 확정돼 있다. **이 문서는 SPEC을
구현 대상 설계로 삼고, SPEC이 정하지 않은 빈칸(Zustand 스토어·소켓 훅 경계·측정
스크립트 형태·UI 분리·읽음 실시간)만 확정한다.** 스키마/API/이벤트 구체는 SPEC 참조.

### 확정된 결정 (사용자)

- **UI**: 1차엔 구분만 되는 최소 뼈대. 로직(소켓 훅·재동기화·큐)과 UI를 분리해,
  나중에 전달받을 HTML 시안으로 **마크업/스타일만 교체**하고 로직 훅은 안 건드린다.
- **읽음 표시**: **실시간**(상대가 읽는 순간 내 화면 갱신). SPEC 8.5 완전 구현.
- **초기 히스토리**: 전체 로드 + 방 진입 시 **최신으로 스크롤**(일반 채팅처럼).
  과거 스크롤 페이지네이션은 **안 함**(FE-1 무한스크롤 주제와 겹침).
- **헤더 안읽음 뱃지**: **페이지 이동/새로고침 때 갱신**(실시간 아님).
- **상태관리**: **Zustand** 도입(소켓 인스턴스·연결상태·미전송 큐 보관). 설치 전 확인.
- **테스트**: 프론트는 Vitest(+Testing Library). 소켓/재동기화 로직은 순수 함수로
  떼어 단위 테스트. 백엔드는 Jest.
- **참고**: 프론트 작성 시 `vercel-react-best-practices`·`frontend-code-style` 스킬,
  라이브러리/모호한 스택은 최신 공식문서 기준. Next.js 16은
  `apps/web/node_modules/next/dist/docs/` 먼저 확인.

## 작업 순서 (한 브랜치 `feature/chat`, 덩어리별로 끊어 진행)

의존상 **0 → 1 → 2 → 3 → 4** 강제. 특히 **2(재현·측정 기준선)를 남기고 사용자
확인 후** 3(해결)으로 간다 — 전후 비교가 불릿의 생명이라(RESUME_STEP 재현 먼저 규칙).

| 덩어리 | 내용 | 완료 판정 |
|---|---|---|
| **0** | 스키마 2개 + 패키지 설치 | migrate·generate 성공, 패키지 설치 확인 |
| **1** | 채팅 정상 동작 (BE 소켓·REST + FE 소켓·UI·읽음·뱃지) | 두 계정으로 대화·저장·재접속 히스토리·실시간 읽음 동작 |
| **2** | 장애 재현 + **해결 전** 측정 | 헤드리스 스크립트로 유실률·재연결분산 기준선 기록 |
| **3** | 유실 3구멍 해결 | 재연결튜닝·재동기화·재전송큐 구현 |
| **4** | 재측정 + 문서 | 동일조건 유실률 0% + records/learn/PLAN 갱신 |

---

## 덩어리 0 — 기반 (스키마 + 패키지)

### 스키마 (`apps/api/prisma/schema.prisma`)

SPEC 2장(78–92행) 그대로. 기존 관례(`Explore` 확인): 대부분 `cuid()` PK, FK는
전부 `onDelete: Cascade`, User 참조는 `@db.Uuid`.

- **ChatRoom**: `id cuid`, `proposalId @unique`(FK→LessonProposal, Cascade),
  `studentId @db.Uuid`(FK→User), `coachId @db.Uuid`(FK→User),
  `studentLastReadMessageId Int?`, `coachLastReadMessageId Int?`, `createdAt`.
  `@@index([studentId])`, `@@index([coachId])`.
- **ChatMessage**: **`id Int @id @default(autoincrement())`** — 이 스키마 유일한
  int PK 예외. 이유를 **스키마 주석에 남긴다**(재동기화 `WHERE id > ?` 단순화).
  `roomId`(FK→ChatRoom, Cascade), `senderId @db.Uuid`(FK→User), `content`,
  `createdAt`. `@@index([roomId, id])`.
- `*LastReadMessageId`는 `ChatMessage.id`를 가리키지만 **FK 없이 단순 Int 커서**.

변경 후: `pnpm --filter=@mulink/api exec prisma generate` +
`prisma migrate dev --name add-chat`.

### 패키지 (설치 전 사용자 확인 — 프로젝트 규칙)

- BE: `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io`
- FE: `socket.io-client`, `zustand`

> Supabase Realtime으로 대체 가능하나 **쓰지 않는다**: FE-2 서사의 창끝이
> "Socket.IO at-most-once → 마지막 수신 ID 재동기화"라서, Realtime으로 바꾸면
> 포트폴리오 서사 자체가 무너진다. socket.io는 SPEC·PLAN에서 이미 확정된 전제.

---

## 덩어리 1 — 채팅 정상 동작

### 백엔드

기존 3층 구조 그대로(`Explore` 확인: 클래스 레벨 `@UseGuards(SupabaseAuthGuard)`,
`req.user.id`, Global PrismaModule, `imports:[AuthModule]`로 SupabaseService 확보,
본인확인-삭제 패턴). Prisma import는 `../../generated/prisma/client`.

**신규 `apps/api/src/chat/`** — `chat.module.ts`(`imports:[AuthModule]`),
`chat.controller.ts`, `chat.service.ts`, `chat.gateway.ts`. `app.module.ts`에 등록.

REST (SPEC 4장 chat 모듈, 컨트롤러 레벨 가드):
- `POST /chat-rooms` (학생만) `{ proposalId }` → 방 생성/취득. `proposalId @unique`
  + `P2002` catch로 **기존 방 조회 반환**(멱등). 참여자 검증.
- `GET /chat-rooms` (공용) → 내 방 목록. 각 항목에 `partner`·`lastMessage`·
  `unreadCount`(`id > 내 lastRead AND senderId != 나`) nested.
- `GET /chat-rooms/:id/messages` → 초기 내역(전체).
- `GET /chat-rooms/:id/messages?after=:id` → **재동기화**(`WHERE id > ?`). 덩어리 3의
  핵심 API지만 조회 자체는 여기서 만들어 둔다.
- 서비스는 참여자(`studentId`/`coachId`) 대조로 접근 검증(내 방 아니면 Forbidden).

소켓 게이트웨이 (SPEC 4장 게이트웨이 절·8장):
- `@WebSocketGateway({ cors:{ origin: WEB_ORIGIN, credentials:true } })`.
- **인증**: `handleConnection`에서 `socket.handshake.auth.token`을
  `SupabaseService.getUser(token)`로 1회 검증 → `socket.data.user`, 실패 시
  `socket.disconnect()`. (HTTP `SupabaseAuthGuard`는 소켓에서 못 씀.)
- 이벤트: `chat:join`(참여자 대조 후 room 입장), `chat:send`(**DB 저장 먼저 →
  방 브로드캐스트**, 순서 고정), `chat:message`(S→C, `clientMsgId` 되실음),
  `chat:ack`(발신자에게 `{clientMsgId,id}`), `chat:read`(뷰어 `*LastReadMessageId`
  갱신 → 상대에게 브로드캐스트). **읽음 실시간은 이 `chat:read` 브로드캐스트로 성립.**

**수정 `apps/api/src/lesson-request/lesson-request.service.ts`** — `getMyLessonRequest`
proposals 평탄화 시 각 proposal에 **`roomId`(이 코치-학생 방 있으면 그 id, 없으면
null)** 추가. 기존 `getOpenLessonRequests`의 `myProposalByRequestId` Map 패턴을 따라
방을 미리 조회해 매핑.

### 프론트엔드 (FSD, `entities`/`features` 패턴 복제)

기존 패턴(`Explore` 확인): entities api는 `'server-only'` + `cache()` + 인라인
fetch + `getSession().access_token` Bearer + `cache:'no-store'`. features action은
`'use server'` 동일 패턴. getCurrentUser는 `entities/user/user.api.ts`.

**신규 `entities/chat/`**
- `chat.type.ts` — 방·메시지·목록 타입(Prisma와 수동 동기화). `ChatMessage`는
  `id:number` 주의. `toRelativeTime`(`shared/lib/relative-time.ts`) 재사용.
- `chat.api.ts` — `getMyChatRooms()`, `getRoomMessages(roomId)`,
  `getRoomMessagesAfter(roomId, id)`(재동기화, 덩어리3에서 호출) SSR 조회.

**신규 `features/chat/`**
- `chat.action.ts`(`'use server'`) — `createChatRoomAction(proposalId)` 방 생성/취득.
- **`store/chat-socket.store.ts` (Zustand)** — 소켓 인스턴스 1개, 연결상태
  (connected/reconnecting), 미전송 큐(`clientMsgId` 키), 마지막 수신 id. 소켓 생성은
  액션 안에서만(`useEffect`), 브라우저 `createClient().auth.getSession()` 토큰을
  핸드셰이크에 전달. `onAuthStateChange`로 토큰 갱신 시 재연결.
  > **App Router 함정(SPEC 5장)**: 소켓을 페이지 컴포넌트에 두면 라우트 이동
  > (목록↔방)에 끊긴다. Zustand 스토어가 라우트 전환에도 안 죽는 전역 1개를 보장.
- **`hooks/`** — 로직을 UI와 분리해 순수하게(Vitest 대상): `useChatSocket`(연결
  생명주기), `useRoomMessages`(수신 병합·중복 제거), `useResync`(재연결시 `?after=`),
  `useSendQueue`(미전송 재전송). 덩어리3에서 채워질 자리도 여기 훅으로 예약.
- **`ui/`** (`'use client'`, **최소 뼈대 — 시안 오면 교체**) — `ChatRoomList`,
  `ChatRoom`(메시지 리스트 + 입력창), `MessageBubble`(좌우 구분·시각·읽음표시),
  `ConnectionStatus`(연결됨/재연결중), `UnreadBadge`. 스타일은 구분만.

**신규 라우트 `app/(chat)/`**
- `layout.tsx`(`'use client'` 아님 — 서버에서 로그인 가드 `if(!user) redirect('/')`,
  role 안 봄). Zustand는 라이브러리 특성상 provider 불필요하나, 소켓 마운트 훅을
  올릴 `'use client'` 경계 컴포넌트를 layout에 삽입.
- `chat/page.tsx`(목록, SSR 초기 조회), `chat/[roomId]/page.tsx`(방, SSR 첫 내역 +
  `'use client'` ChatRoom).

**수정**
- `features/lesson-request/ui/my-request/CoachProfileDrawer.tsx` — "카톡 1:1 상담"
  버튼(빈 onClick)을 **채팅하기/채팅 계속하기**로. `roomId`가 null이면
  `createChatRoomAction` 후 `/chat/:roomId`, 있으면 바로 이동.
  (`CoachProfileDrawer.test.tsx`도 갱신.)
- `widgets/Header.tsx`(서버 컴포넌트) — 드롭다운에 `<Link href="/chat">`,
  안읽음 뱃지는 서버에서 count 조회해 표시(**새로고침 갱신** — 실시간 아님).

### 덩어리 1 검증

두 계정(학생·코치)으로: 제안에서 방 생성 → 실시간 대화 → 새로고침 후 히스토리 유지
(DB 영속) → 방 진입 시 읽음 처리 + **상대가 읽는 순간 읽음 표시 갱신** → 헤더 뱃지가
새 메시지 후 새로고침 때 반영. Vitest: 수신 병합·중복 제거 순수 함수 단위 테스트.

---

## 덩어리 2 — 장애 재현 + 측정 (해결 전) ★ 포트폴리오 기준선

> 이 덩어리 산출물이 포트폴리오 **[성과]의 "전(before)" 수치**다. 수치를 남기고
> **사용자 확인 후** 덩어리 3으로.

**헤드리스 측정 스크립트** (`scripts/` 또는 `apps/api/scripts/`에 **보존** — 면접
"어떻게 측정했어요?"의 답):
- Node에서 `socket.io-client` 두 클라이언트가 **일정 rate로 번호 붙인 메시지**를
  주고받는 중, 로컬 `docker restart <api컨테이너>`로 재시작.
- **송신 수 대비 수신 수**로 유실률 집계(번호로 누락분 식별).
- 재연결 폭풍용: 클라이언트 N개 띄워 **재연결 타임스탬프 분산** 기록.
- 재현 조건(kill 타이밍·메시지 rate·클라이언트 수)을 스크립트에 **박제**(수치가
  조건 의존적이라 — RESUME_PLAN FE-2). 결과는 "이 재현 조건에서 유실률 N%"로 표기.

로컬 `docker restart` = 실서버 재배포와 동일 메커니즘(SPEC 6단계 순서 주의). 도메인·
`wss://` 불필요. `docs/private/records/6-chat.md`에 해결 전 수치·조건 기록.

---

## 덩어리 3 — 유실 3구멍 해결

- **① 재연결 폭풍 (백오프+지터)**: socket.io-client 옵션 `reconnectionDelay`(1000)·
  `reconnectionDelayMax`(5000)·`randomizationFactor`(0.5). 커스텀 로직 없음(내장).
  Zustand 스토어의 소켓 생성부에 옵션 지정.
- **② 메시지 유실 (재동기화 — 창끝)**: FE가 방에서 받은 **마지막 메시지 id 보관**
  (Zustand) → 재연결(`connect`) 직후 `getRoomMessagesAfter(roomId, lastId)` 호출 →
  DB에서 끊긴 사이 쌓인 메시지만 받아 **id 기준 중복 제거하며 병합**. DB가 진실의
  원천. (`useResync` 훅.)
- **③ 미전송 (재전송 큐)**: `chat:send` 시 `clientMsgId` 부여 + 미확정 큐에 넣고
  낙관적 렌더(pending). `chat:ack{clientMsgId,id}` 받으면 큐 제거·실제 id 확정.
  끊긴 채 보낸(미ack) 항목은 재연결 시 자동 재전송. 서버가 `chat:message`에
  `clientMsgId` 되실어 **낙관 렌더분과 중복 제거**. 큐는 인메모리(새로고침 시 소실 —
  초기 내역 재조회로 복구). (`useSendQueue` 훅.)

Vitest: 중복 제거 병합·큐 dedup을 순수 함수 단위 테스트(소켓 없이).

---

## 덩어리 4 — 재측정 + 문서

- 덩어리 2와 **동일 조건**으로 재측정 → **유실률 0%**(재현 조건에서 유실 0건 관측) +
  재연결 타임스탬프 분산 확인.
- **`docs/private/records/6-chat.md`** — 전후 표·배경·해결·실동작 증거·스크립트 경로.
  이 문서가 **포트폴리오 5섹션(제목/그림/문제/해결/성과)의 직접 입력**이 되도록
  작성한다(portfolio-writing 스킬 기준):
  - [문제] 재료: "왜 소켓 기본(at-most-once)이 유실을 내는지" 배경 + 영향.
  - [해결] 재료: "CSR 대신 DB 재동기화를 택한 판단 근거"(RESUME_PLAN FE-2 면접 방어
    2단 반박 그대로), 세 구멍 각 해결 방식.
  - [성과] 재료: 재현 조건 명시 + 전후 수치(유실률 N%→0%), 재연결 분산.
  - "장애 가정" 표현 금지 — 실제 재현·해결한 일로 서술.
- **`docs/private/learn/6-chat.md`** — HTTP vs WebSocket, 소켓 push/pull과 왜 DB를
  스스로 안 뒤지는지, 소켓 생애(연결→끊김→재연결), 재연결만으로 복구 안 되는 이유,
  마지막 ID 재동기화로 at-least-once 만들기, 재연결 폭풍·백오프+지터.
- **RESUME_PLAN.md FE-2** 예시 불릿 수치를 실측값으로 갱신, RESUME_STEP 6단계
  체크박스 채움.

---

## 재사용 / 주의

- BE: Global PrismaModule → `imports:[AuthModule]`만으로 Prisma·Supabase 확보.
  본인확인-삭제(`removeLessonRequest`) 패턴, `myProposalByRequestId` Map 패턴 참고.
- FE: entities/features fetch 패턴 그대로 복제. `toRelativeTime`, `shared/ui`의
  avatar·badge·button·input·textarea 재사용.
- **로직↔UI 분리가 이 설계의 축**: 소켓·재동기화·큐는 `hooks/`·`store/`의 순수
  로직으로, UI는 `ui/`의 교체 가능한 뼈대로. 시안(HTML)은 UI만 바꾼다.
- 측정·재현 스크립트 **삭제 금지**(포트폴리오 근거).
