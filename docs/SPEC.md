# MU:LINK 개발 스펙 문서 (1차 MVP)

이 문서는 [PRODUCT.md](./PRODUCT.md)(기획 문서)를 구현으로 번역한 것이다.
기획이 바뀌면 이 문서를 고친다. 이 문서가 바뀌어도 기획 문서는 건드리지 않는다.

코드 작성 패턴/규칙(모듈 3층 구조, URL 작명 규칙, 프론트 API 호출 방식 등)은 이 문서가 아니라 각 앱의 `CLAUDE.md`에 둔다. 이 문서는 "무엇을 만드나"(도메인·API·페이지·환경)만 다룬다.

---

## 1. 기술 스택

### 백엔드 (@mulink/api)

- NestJS 11
- Prisma 7 (`@prisma/adapter-pg` + `pg` — Postgres 직접 연결). Client는 `apps/api/generated/prisma`로 생성.
- Supabase JS 2 (인증)
- AWS SDK v3 (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` — S3 presigned URL 발급)
- cookie-parser, ws
- 테스트: Jest

### 프론트 (@mulink/web)

- Next.js 16 App Router + React 19 (React Compiler 활성화)
- Supabase SSR (`@supabase/ssr`) + Supabase JS
- 폼: react-hook-form + zod (`@hookform/resolvers`)
- UI: radix-ui, shadcn, Tailwind CSS v4, lucide, vaul(drawer)
- 아키텍처: Feature-Sliced Design (자세한 규칙은 `apps/web/CLAUDE.md`)
- 테스트: Vitest + Testing Library

### 공통

- 모노레포: pnpm + Turborepo
- DB: Supabase (PostgreSQL)

---

## 2. DB 모델

Prisma 스키마 위치: `apps/api/prisma/schema.prisma`

스키마를 수정한 뒤에는 아래를 실행한다.

```sh
# 1. Prisma Client 재생성 (generated/prisma 갱신) — 타입 반영에 필수
pnpm --filter=@mulink/api exec prisma generate

# 2. 변경을 DB에 반영 (택1)
pnpm --filter=@mulink/api exec prisma migrate dev --name <변경명>   # 개발: 마이그레이션 파일 생성 + 적용
pnpm --filter=@mulink/api exec prisma db push                       # 프로토타이핑: 마이그레이션 없이 스키마만 밀어넣기
```

### 엔티티 6개

**User (유저)** — 기획: 카카오 로그인 / 온보딩
- 카카오로 가입한 모든 사용자. `role`(STUDENT / COACH / ADMIN)로 역할 구분.
- PK는 Supabase Auth의 `auth.users.id`(UUID)와 동일하게 채운다 (자동생성 X).
- 주요 필드: `kakaoId`(unique), `nickname`, `role`(기본 STUDENT), `createdAt`

**CoachProfile (코치 프로필)** — 기획: 코치 가입 페이지
- User와 1:1. 코치로 전환한 유저만 가진다.
- 주요 필드: `userId`(FK, unique), `activityName`(활동명, 텍스트), `region`(활동 지역, `Region` enum · 단일 값), `imageUrl`(프로필 이미지 S3 URL, **nullable** — 미등록 시 학생 화면에서 기본 아바타 표시)
- User 삭제 시 cascade.
- 이미지 파일 자체는 AWS S3에 두고, DB에는 그 공개 URL 문자열만 저장한다. 업로드 방식은 7장 참고.

**LessonRequest (레슨 신청)** — 기획: 레슨 신청 작성 / 내 레슨 신청 현황 페이지
- 학생이 올린 "레슨 받고 싶어요" 모집글.
- 주요 필드: `studentId`(FK → User, **unique**), `region`(희망 지역, `Region` enum · 단일 값), `goal`(레슨 목적, 텍스트), `genre`(선호 장르, `Genre` enum · 단일 값), `createdAt`
- **`studentId`는 unique** — 1인 1신청을 DB 제약으로 보장한다 (앱 레벨 체크만으로는 동시 요청에 뚫린다).
- User(학생) 삭제 시 cascade.

**LessonProposal (레슨 제안)** — 기획: 레슨 신청 목록 페이지 (코치) *(신규 추가 필요)*
- 코치가 특정 레슨 신청에 보낸 제안.
- 주요 필드: `requestId`(FK → LessonRequest), `coachId`(FK → User), `message`(제안 한마디, 텍스트), `createdAt`
- **`@@unique([requestId, coachId])`** — 1레슨 신청 1레슨 제안 규칙 (같은 코치가 같은 신청에 중복 제안 불가)
- LessonRequest 삭제 시 cascade (기획: 신청 삭제 시 제안 함께 삭제)
- 코치 프로필(활동명·지역)은 제안에 담지 않는다. `coachId`로 User→CoachProfile을 조회해 붙인다. (조회는 `GET /lesson-requests/me` 응답에 nested로 녹인다 — 4장 참고)

**ChatRoom (채팅방)** — 기획: 채팅 목록 / 채팅방 페이지 *(신규 추가 필요)*
- 학생이 특정 레슨 제안에서 "채팅하기"를 눌렀을 때 생성되는 1:1 방. 한 제안(학생-코치 쌍)당 방 1개.
- 주요 필드: `proposalId`(FK → LessonProposal, **unique**), `studentId`(FK → User, `@db.Uuid`), `coachId`(FK → User, `@db.Uuid`), `studentLastReadMessageId`(`Int?`), `coachLastReadMessageId`(`Int?`), `createdAt`
- **`proposalId`는 unique** — "1제안 1방"을 DB 제약으로 보장 (기존 `LessonRequest.studentId @unique` 패턴과 동일 근거: 앱 레벨 체크만으로는 동시 요청에 뚫린다).
- LessonProposal 삭제 시 cascade. 기획상 방 삭제 트리거(제안 취소·신청 삭제·코치 전환)는 모두 제안이 지워지는 경로라 이 cascade 체인으로 정리된다. (코치 전환은 `POST /coach-profiles` 트랜잭션이 그 유저의 LessonRequest→LessonProposal을 지우므로 방도 함께 삭제됨 — 구현 시 실제 삭제 순서 확인 필요)
- **읽음 추적은 방에 두 컬럼(`studentLastReadMessageId`·`coachLastReadMessageId`)으로 둔다.** 참여자가 방당 2명으로 고정이라 별도 조인 테이블(ChatRoomParticipant)은 만들지 않는다. 안 읽은 개수는 `id > 내 lastRead AND senderId != 나`로 집계한다.
- `@@index([studentId])`, `@@index([coachId])` (내 채팅 목록 조회용)

**ChatMessage (채팅 메시지)** — 기획: 채팅방 페이지 *(신규 추가 필요)*
- 방에 오간 개별 메시지. 텍스트 전용(MVP).
- 주요 필드: `id`(**`Int @id @default(autoincrement())`**), `roomId`(FK → ChatRoom), `senderId`(FK → User, `@db.Uuid`), `content`(텍스트), `createdAt`
- **`id`가 자동증가 정수인 것은 이 스키마에서 유일한 예외다** (다른 도메인 모델은 `cuid()`). 이유: 재연결 후 유실 복구 시 "이 ID 이후 메시지"(`?after=<id>`)를 단조증가 정수로 단순 조회(`WHERE id > ?`)하기 위함 — 8장 참고. **이 예외를 스키마 주석에도 남긴다.**
- ChatRoom 삭제 시 cascade.
- `@@index([roomId, id])` — 방별 메시지를 id 순으로 훑는 내역 조회·재동기화의 핵심 인덱스.
- `studentLastReadMessageId` 등은 `ChatMessage.id`를 가리키지만 **FK 제약은 걸지 않고 단순 Int 커서로 둔다** (읽은 메시지가 지워져도 커서 값만 남으면 됨).

> 필드 필수 여부·글자 수 제한 등 상세 제약은 구현 시 DTO(zod/class-validator)에서 확정한다. enum 값의 실제 목록은 아래 enum 절 참고.

### enum

- `Role`: STUDENT / COACH / ADMIN
- `Region`: SEOUL, GYEONGGI, INCHEON, BUSAN, DAEGU, ULSAN, GWANGJU, DAEJEON
- `Genre`: POP, BALLAD, ROCK, RNB, JAZZ, HIPHOP, TROT
- `VocalTier`: BRONZE~DIAMOND *(정의만 되어 있고 MVP에서 미사용 — 보류)*

---

## 3. 인증 흐름

카카오 OAuth로 신원을 확인하고, Supabase가 세션(JWT)을 발급한다. 토큰을 URL에 노출하지 않기 위해 1회용 `sessionCode` 교환권 방식을 쓴다.

| 단계 | 주체 | 동작 |
|:---:|:---|:---|
| 1 | web → 서버 | `GET /auth/kakao/authorize` — state 쿠키를 심고 카카오 동의화면으로 redirect (CSRF 방어) |
| 2 | 카카오 → 서버 | `GET /auth/kakao/callback` — code 수신 → 카카오 토큰·프로필 조회, state 대조 |
| 3 | 서버 | Supabase admin으로 세션 발급 (합성이메일 `kakaoId@kakao.local` + magiclink → verifyOtp) |
| 4 | 서버 → web | 세션토큰을 서버 메모리에 저장(30초 TTL), 1회용 sessionCode만 web으로 redirect |
| 5 | web → 서버 | `POST /auth/session/exchange` — sessionCode → 실제 세션토큰(access/refresh) 교환 |
| 6 | 이후 요청 | `Authorization: Bearer <JWT>` 를 SupabaseAuthGuard가 Supabase에 위임 검증 |

- 카카오 scope: `profile_nickname profile_image` (이메일 안 받음)
- 첫 로그인 시 `POST /users`로 `auth.users.id`(UUID) 기반 `public.User`를 생성(upsert)한다.

---

## 4. API 엔드포인트

모듈은 도메인(모델) 단위로 만든다. `auth`만 모델 없는 "과정 모듈"이라 리소스가 아닌 동사형 URL을 허용한다.

### 인증 — `auth` 모듈 (리소스 아닌 과정)

| 메서드 | 경로 | 설명 |
|:---|:---|:---|
| GET | `/auth/kakao/authorize` | 카카오 로그인 시작 (동의화면 redirect) |
| GET | `/auth/kakao/callback` | 카카오 콜백 (code 수신 → 세션코드 발급) |
| POST | `/auth/session/exchange` | 세션코드 → 세션토큰 교환 |


### 유저 — `user` 모듈

| 메서드 | 경로 | 설명 |
|:---|:---|:---|
| POST | `/users` | 첫 로그인 시 유저 생성(upsert) |
| GET | `/users/me` | 내 정보 (역할 포함) |


### 코치 프로필 — `coach-profile` 모듈

| 메서드 | 경로 | 설명 |
|:---|:---|:---|
| POST | `/coach-profiles/upload-url` | 프로필 이미지 업로드용 S3 presigned URL 발급 |
| POST | `/coach-profiles` | 코치 가입(전환) — 활동명·지역·(선택)이미지 URL 등록 |

> `POST /coach-profiles/upload-url`은 클라이언트가 S3에 이미지를 직접 올리기 위한 presigned PUT URL을 발급한다. body로 파일 정보(contentType 등)를 받아 서버가 IAM 권한으로 서명한 임시 URL과, 업로드 후 접근할 공개 URL을 반환한다. 원본/변환본 파일은 서버를 거치지 않고 브라우저 → S3로 직접 전송된다(서버 대역폭·부하 절감). 상세 흐름은 7장 참고.
>
> `POST /coach-profiles`는 하나의 트랜잭션으로 처리한다: ① CoachProfile 생성(활동명·지역·`imageUrl`) ② `User.role`을 COACH로 변경 ③ 그 유저의 기존 LessonRequest(및 cascade로 딸린 LessonProposal) 삭제. `imageUrl`은 앞서 발급받은 presigned URL로 S3 업로드를 마친 뒤 얻은 공개 URL이며, 미등록 시 생략 가능(nullable). 코치 프로필 조회 전용 GET은 두지 않는다 — 코치 프로필은 `GET /lesson-requests/me` 응답에 nested로 포함된다.


### 레슨 신청 — `lesson-request` 모듈

| 메서드 | 경로 | 설명 |
|:---|:---|:---|
| POST | `/lesson-requests` | 신청 생성 (학생) |
| GET | `/lesson-requests` | 모집중 신청 목록 + 내가 보낸 제안 조회 (코치) |
| GET | `/lesson-requests/me` | 내 신청 + 받은 제안 조회 (학생) |
| DELETE | `/lesson-requests/:id` | 신청 삭제 (제안 cascade) |


### 레슨 제안 — `lesson-proposal` 모듈

| 메서드 | 경로 | 설명 |
|:---|:---|:---|
| POST | `/lesson-requests/:id/lesson-proposals` | 제안 생성 (1신청 1제안) |
| DELETE | `/lesson-proposals/:id` | 제안 취소 *(미구현 — 신규 추가 필요)* |


### 채팅 — `chat` 모듈 *(신규 추가 필요)*

REST는 **방 생성·초기 내역·재동기화**만 담당하고, 실시간 메시지 송수신·읽음은 WebSocket이 맡는다(8장). `app.module.ts` imports에 `ChatModule` 등록.

| 메서드 | 경로 | 설명 |
|:---|:---|:---|
| POST | `/chat-rooms` | 채팅방 생성/취득 (학생만). body `{ proposalId }`. 이미 있으면 기존 방 반환(멱등) |
| GET | `/chat-rooms` | 내 채팅방 목록 (학생·코치 공용, `/chat` 화면용) |
| GET | `/chat-rooms/:id/messages` | 방 초기 내역 (최근 N건) |
| GET | `/chat-rooms/:id/messages?after=:messageId` | **재동기화** — 해당 id 초과 메시지만 (8장 핵심) |

- 컨트롤러는 기존 패턴대로 `@UseGuards(SupabaseAuthGuard)`를 컨트롤러 레벨에 붙이고(`lesson-proposal.controller.ts` 참고), 서비스는 `PrismaService` 주입 후 참여자(`studentId`/`coachId`) 대조로 접근 검증한다.
- 방 생성 "1개만"은 `proposalId @unique` + 서비스에서 `P2002` catch로 처리하되, 멱등 취득이므로 예외 대신 **기존 방을 조회해 반환**한다.
- `GET /chat-rooms`(목록)와 `GET /lesson-requests/me`(학생 내 신청)는 기존처럼 **화면 지향 엔드포인트**다. 목록 각 항목에 상대 표시정보(`partner`)·마지막 메시지(`lastMessage`)·안 읽은 수(`unreadCount`)를 nested로 녹인다.


### 규칙

- 모델 있는 모듈은 **모델명 = 모듈명 = URL** 을 일치시킨다.
- `/me`는 "현재 로그인 유저"를 뜻하는 관용 표현.
- `GET /lesson-requests/me`(학생 내 신청)는 **화면 지향 엔드포인트**다. 내 신청 화면에 필요한 신청·받은 제안·각 제안 코치 프로필을 **한 번에 nested로 반환**한다. (제안·프로필을 별도 GET으로 나누면 화면 하나에 1+1+N 요청이 발생하므로, Prisma `include`로 join해 한 방에 준다.)

  응답 형태 예시:
  ```jsonc
  // 신청이 없으면 null (또는 빈 응답) → 프론트는 빈 상태로 처리
  {
    "id": "...", "region": "SEOUL", "goal": "...", "genre": "BALLAD", "createdAt": "...",
    "proposals": [                              // 최신순 정렬, 없으면 []
      {
        "id": "...", "message": "...", "createdAt": "...",
        "coachProfile": { "activityName": "...", "region": "SEOUL", "imageUrl": "https://<버킷>.s3.<리전>.amazonaws.com/..." },  // CoachProfile nested, imageUrl은 미등록 시 null
        "roomId": "room_..." | null             // 이 코치와의 채팅방이 이미 있으면 그 id, 없으면 null → 프론트는 "채팅 계속하기"/"채팅하기" 버튼을 구분해 표시
      }
    ]
  }
  ```

- `GET /lesson-requests`(코치 목록)도 **화면 지향 엔드포인트**다. 레슨 신청 목록 페이지(코치)가 둘러보기·제안 보내기·제안 취소를 한 화면에서 처리하므로, 각 신청 항목에 "내가 이미 보낸 제안"을 `myProposal`로 nested 반환한다(제안 없으면 `null`). 별도로 내가 보낸 제안만 모아 조회하는 화면·엔드포인트는 없다(`GET /lesson-proposals/me`는 만들지 않음 — 코치용 "보낸 제안 목록 페이지"가 사라졌기 때문).

  응답 형태 예시:
  ```jsonc
  [
    {
      "id": "...", "region": "SEOUL", "goal": "...", "genre": "BALLAD", "createdAt": "...",
      "studentNickname": "...",
      "myProposal": null   // 아직 제안 안 보낸 신청 — 프론트는 제안 보내기 폼을 보여줌
    },
    {
      "id": "...", "region": "BUSAN", "goal": "...", "genre": "ROCK", "createdAt": "...",
      "studentNickname": "...",
      "myProposal": { "id": "...", "message": "...", "createdAt": "..." }   // 이미 보낸 제안 — 프론트는 "제안 완료" 뱃지 + 펼치면 한마디·발송 시각·취소 버튼을 보여줌
    }
  ]
  ```

  > **구현 필요**: 현재 `lesson-request.service.ts`의 `getOpenLessonRequests`는 `isProposed`(boolean)만 내려준다. 위 응답 형태(`myProposal` nested 객체)로 바꿔야 한다 — 코치가 보낸 제안 id/message/createdAt까지 함께 조회하도록 수정.
  >
  > **구현 필요**: `DELETE /lesson-proposals/:id`(제안 취소)는 표에만 있고 실제 컨트롤러/서비스 코드가 없다. `lesson-proposal.controller.ts`/`lesson-proposal.service.ts`에 추가해야 한다. 본인이 보낸 제안인지 확인(coachId 대조) 후 삭제하는 방식으로, 기존 `lesson-request.service.ts`의 `removeLessonRequest`(본인 확인 후 삭제) 패턴을 따른다.

### 모듈 재구조화 (해야 할 일)

현재 `auth` 폴더에 유저 리소스(`@Controller('users')`)가 섞여 있다. 이를 분리한다.

- `auth` 모듈: 인증 "과정"만 유지 (kakao-auth, session 컨트롤러 + 관련 서비스, `SupabaseAuthGuard`, `SupabaseService`)
- `user` 모듈 신설: 유저 리소스(`POST /users`, `GET /users/me`)를 옮긴다. 기존 `auth.service`의 `upsertUser`/`getMe` 로직도 `user.service`로 이동.

### WebSocket 게이트웨이 (채팅 실시간) *(신규 추가 필요)*

실시간 메시지 송수신·읽음은 REST가 아니라 socket.io 게이트웨이(`chat.gateway.ts`)로 처리한다. 설치 필요: `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io`. (기존 `ws` 의존성은 Supabase realtime용이라 무관.)

- **CORS**: `main.ts`의 `enableCors`는 HTTP 전용이라 소켓엔 안 걸린다. `@WebSocketGateway({ cors: { origin: WEB_ORIGIN, credentials: true } })`로 게이트웨이에서 직접 지정한다.
- **인증(핸드셰이크 1회)**: 기존 HTTP `SupabaseAuthGuard`는 `context.switchToHttp()`에 묶여 소켓에서 못 쓴다. 대신 `ChatModule`이 `imports:[AuthModule]`(AuthModule이 `SupabaseService`를 exports함)로 `SupabaseService`를 주입받아, `handleConnection`에서 `socket.handshake.auth.token`을 꺼내 `SupabaseService.getUser(token)`로 검증 → 성공 시 `socket.data.user`에 담고, 실패 시 `socket.disconnect()`. 핸드셰이크 때 한 번만 인증하고 이후 이벤트는 신뢰한다.

| 이벤트(방향) | 이름 | 페이로드 | 동작 |
|:---|:---|:---|:---|
| C→S | `chat:join` | `{ roomId }` | 참여자 대조 후 방 입장 |
| C→S | `chat:send` | `{ roomId, content, clientMsgId }` | **DB 저장 먼저 → 방에 브로드캐스트** (순서 고정: 저장돼야 재배포 유실 방지). `clientMsgId`는 미전송 큐 dedup·ack 매칭용 |
| S→C | `chat:message` | `{ id, roomId, senderId, content, createdAt, clientMsgId }` | 방 전원에게 새 메시지 |
| S→C(발신자) | `chat:ack` | `{ clientMsgId, id }` | 미전송 큐에서 확정 제거용 |
| C→S / S→C | `chat:read` | `{ roomId, lastReadMessageId }` | 뷰어의 `*LastReadMessageId` 갱신 → 상대에게 읽음 위치 브로드캐스트 |

---

## 5. 프론트 페이지 URL

역할이 확실히 구분되므로 역할 prefix를 URL에 노출하고, Next.js Route Group `(폴더)`으로 코드를 역할별로 묶는다. 페이지 URL의 리소스명은 API·모델과 3층을 일치시킨다(`lesson-request`).

| URL | 역할 | 폴더 그룹 | 기획 화면 |
|:---|:---|:---|:---|
| `/` | 공용 | `(public)` | 로그인 상태 따라 분기 |
| `/login` | 공용 | `(public)` | 카카오 로그인 페이지 |
| `/auth/callback` | 공용 | `(public)` | 로그인 콜백 처리 (세션코드 교환) |
| `/coach-register` | 학생→코치 | 독립 (그룹 없음) | 코치 가입 페이지 |
| `/student/lesson-request` | 학생 | `(student)` | 내 레슨 신청 현황 + 받은 제안 |
| `/student/lesson-request/new` | 학생 | `(student)` | 레슨 신청 작성 |
| `/coach/lesson-requests` | 코치 | `(coach)` | 모집중 레슨 신청 목록 (제안 보내기/취소 포함) |
| `/chat` | 공용(로그인) | `(chat)` | 채팅방 목록 |
| `/chat/:roomId` | 당사자 2명 | `(chat)` | 채팅방 |

### 규칙

- **URL은 기능/리소스 기준, 역할은 접근 권한(가드)으로 처리.** 역할 그룹은 Route Group으로 묶어 그룹별 `layout.tsx`에 권한 가드·네비게이션을 둔다.
- **`/coach-register`는 역할 그룹에 넣지 않는다.** "아직 학생인 사람이 코치가 되는" 페이지라 `(coach)` 그룹에 두면 코치 가드에 스스로 막히고, `(student)`에 두면 전환 후 접근이 애매하다. 그룹 없는 독립 라우트로 두고, 페이지 자체에서 "로그인됨 + 아직 학생"만 확인한다.
- 단수/복수로 "내 하나" vs "여러 목록"을 구분: `/student/lesson-request`(1인 1신청, 단수) vs `/coach/lesson-requests`(목록, 복수).
- 페이지 URL ≠ API URL (기준이 다름: 페이지는 사용자 여정, API는 데이터 자원).
- 확장 시 기존 URL을 갈아엎지 않고 해당 역할 그룹에 새 페이지를 추가한다.
- **`(chat)` 그룹은 역할이 아니라 "로그인"만 가른다.** `(student)`/`(coach)` layout이 role까지 가드하는 것과 달리, `(chat)/layout.tsx`는 `getCurrentUser()` → `if(!user) redirect('/')`만 한다(채팅은 학생·코치 공용). 방 당사자 검증은 서버(REST·소켓 참여자 대조)가 하므로 FE는 방 진입 자체를 막지 않아도 된다.

### 채팅 프론트 배치 (FSD) — 신규 작업 시 참고

- 라우트: `app/(chat)/layout.tsx`(로그인 가드), `app/(chat)/chat/page.tsx`(목록), `app/(chat)/chat/[roomId]/page.tsx`(채팅방).
- `entities/chat/` — `chat.type.ts`(방·메시지·목록 타입, Prisma와 수동 동기화), `chat.api.ts`(`server-only`, SSR 초기 조회 — 기존 `lesson-request.api.ts`의 인라인 fetch + `Bearer session.access_token` 패턴 복제).
- `features/chat/` — `chat.action.ts`(`'use server'`, 방 생성/취득), `ui/*.tsx`(`'use client'` 채팅방·목록·입력창), 소켓 연결 훅·미전송 큐·재동기화 훅.
- **함정(꼭 지킬 것)**: App Router는 클라이언트 네비게이션이라 소켓을 페이지 컴포넌트에 두면 라우트 이동(목록↔방) 시 연결이 끊긴다. **소켓 인스턴스는 라우트 전환에도 언마운트되지 않는 상위 전역 스코프(`(chat)/layout.tsx` 또는 전역 상태관리)에 1개 올려** 연결이 유지되게 한다. 연결 생성은 `useEffect` 안에서만, cleanup에서 정리.
- **클라이언트 세션**: `shared/lib/supabase/client.ts`의 `createClient()`(browser)로 `session.access_token`을 소켓 핸드셰이크에 넘긴다(첫 클라이언트측 supabase 사용처). `onAuthStateChange`로 토큰 갱신 시 재연결.
- **헤더**(`widgets/Header.tsx`): 드롭다운에 채팅 진입(`DropdownMenuItem asChild + <Link href="/chat">`) 추가. Header는 서버 컴포넌트라 실시간 안읽음 뱃지를 직접 못 붙이므로, **안읽음 뱃지는 소켓을 구독하는 별도 `'use client'` 위젯**으로 만들어 Header에 삽입한다(뱃지는 `shared/ui/badge`).
- **카톡 버튼 교체**: `features/lesson-request/ui/my-request/CoachProfileDrawer.tsx`의 "카톡 1:1 상담" 버튼(현재 `onClick`이 빈 함수)을 "채팅하기/채팅 계속하기"로. 각 제안의 `roomId`(위 4장 `GET /lesson-requests/me` 응답에 추가됨)가 `null`이면 방 생성 액션 후 `/chat/:roomId`로, 있으면 바로 그 방으로 이동한다.

---

## 6. 환경변수

```
# 카카오 OAuth
KAKAO_REST_API_KEY
KAKAO_CLIENT_SECRET
KAKAO_REDIRECT_URI

# Supabase
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY      # admin — 세션 발급용 (DB 전체 권한, 서버 전용)
SUPABASE_PUBLISHABLE_KEY       # JWT 위임 검증용

# AWS S3 (코치 프로필 이미지 저장 — presigned URL 발급용)
AWS_REGION                     # 예: ap-northeast-2
AWS_ACCESS_KEY_ID              # IAM 사용자 액세스 키 (S3 PutObject 권한)
AWS_SECRET_ACCESS_KEY          # IAM 사용자 시크릿 키
S3_BUCKET                      # 프로필 이미지 버킷명 (퍼블릭 읽기)

# 기타
WEB_ORIGIN                     # 로그인 후 web 리다이렉트 주소
```

> **채팅(WebSocket)용 신규 환경변수는 없다.** socket.io는 기존 NestJS 서버와 같은 호스트·포트(`PORT`, 기본 4000)에 얹히므로, 프론트 소켓 연결 주소는 기존 `NEXT_PUBLIC_API_URL`을 재사용한다. 게이트웨이 CORS 오리진도 기존 `WEB_ORIGIN`을 쓴다. (소켓 서버를 물리적으로 분리하게 되면 그때 별도 `NEXT_PUBLIC_SOCKET_URL`을 추가한다.)

---

## 7. 코치 프로필 이미지 업로드

코치 가입 시 프로필 이미지를 등록할 수 있다(선택). 이미지는 **브라우저에서 AWS S3로 직접 업로드**하고, 서버에는 그 공개 URL만 저장한다. 원본 파일이 백엔드를 거치지 않으므로 서버 대역폭·처리 부하·스토리지를 아끼는 것이 이 설계의 목적이다.

### 저장소

- **AWS S3** 버킷 하나(프로필 이미지 전용, **퍼블릭 읽기**). 이미지 파일 자체는 S3, DB(`CoachProfile.imageUrl`)에는 공개 URL 문자열만 둔다.
- 버킷 **CORS 설정 필수**: 브라우저가 presigned URL로 `PUT` 하려면 웹 오리진(로컬·Amplify 배포 도메인)에 대한 `PUT`/`GET` 허용이 있어야 한다.

### 업로드 흐름 (클라이언트 직접 업로드 + presigned URL)

| 단계 | 주체 | 동작 |
|:---:|:---|:---|
| 1 | web | 사용자가 이미지 파일 선택 → **브라우저에서 축소·변환**(긴 변 상한 리사이징 + WebP, 아래 참고) |
| 2 | web → 서버 | `POST /coach-profiles/upload-url` — 변환본의 contentType 등을 보내 presigned PUT URL 요청 |
| 3 | 서버 → web | IAM 권한으로 서명한 presigned PUT URL + 업로드 후 접근할 공개 URL 반환 |
| 4 | web → S3 | presigned URL로 변환본을 **S3에 직접 `PUT`** (백엔드 미경유) |
| 5 | web → 서버 | `POST /coach-profiles` — 활동명·지역과 함께 S3 공개 URL(`imageUrl`) 전송 → DB 저장 |

- 이미지 미등록 시 2~4단계를 건너뛰고 `imageUrl` 없이 5단계만 수행한다.
- 업로드 실패 시 코치 가입을 완료하지 않는다(PRODUCT 엣지케이스: 1차엔 이미지 수정 수단이 없어 업로드 성공을 가입 조건으로 둠).

### 브라우저 이미지 축소 (1단계 상세)

- **Canvas API**로 업로드 직전 원본을 축소한다: `drawImage`로 긴 변 기준 리사이징(비율 유지, 목록 표시와 상세 확대를 모두 커버하는 상한) → `toBlob('image/webp', quality)`로 WebP 변환.
- **HEIC**(아이폰 기본 포맷)는 브라우저 Canvas가 못 읽으므로 변환 처리, **EXIF 회전** 정보 반영, **WebP 미지원 브라우저는 JPEG 폴백**.
- 표시는 목록 아바타에서 `next/image`로 렌더한다(`next.config.ts`의 `images.remotePatterns`에 S3 도메인 등록 필요).

> 축소를 서버(sharp)가 아니라 클라이언트에서 하는 이유: 서버 변환은 원본이 이미 업로드된 뒤라 업로드 대역폭·서버 수신 부하·원본 스토리지를 줄이지 못한다. 브라우저에서 미리 줄이면 축소본만 네트워크를 타므로 이 비용들이 함께 줄어든다.

---

## 8. 채팅 실시간 통신

1:1 실시간 채팅은 socket.io로 구현하며, **서버 재배포(재시작) 시 발생하는 세 가지 문제**를 각각의 메커니즘으로 해결하는 것이 이 장의 핵심이다. 메시지는 항상 DB(ChatMessage)에 영속되고, 소켓은 실시간 전달 통로다. 게이트웨이 이벤트·인증은 4장 참고.

### 8.1 연결·인증

- 프론트는 `shared/lib/supabase/client.ts`의 `createClient()`(browser)로 얻은 `session.access_token`을 소켓 핸드셰이크 `auth: { token }`으로 넘긴다. 서버는 핸드셰이크에서 이 토큰을 `SupabaseService.getUser()`로 1회 검증한다(4장).
- 소켓은 라우트 전환에도 유지되도록 상위 전역 스코프(`(chat)/layout.tsx` 또는 전역 상태관리)에 1개만 생성한다. 토큰 갱신(`onAuthStateChange`) 시 새 토큰으로 재연결한다.

### 8.2 문제① 재연결 폭풍 — 백오프 + 지터

재배포로 서버가 내려가면 다수 클라이언트가 동시에 재연결을 시도해 막 살아난 서버를 재타격한다. socket.io-client 내장 옵션으로 완화한다: `reconnectionDelay`(초기 지연)·`reconnectionDelayMax`(상한)로 재시도 간격을 지수 증가시키고, `randomizationFactor`(지터)로 무작위 분산해 동시 재접속을 흩는다. (커스텀 로직 불필요 — 라이브러리 내장.)

### 8.3 문제② 메시지 유실 — DB 영속 + 마지막 수신 ID 재동기화 (핵심)

끊긴 사이 상대가 보낸 메시지는 재연결돼도 소켓이 다시 밀어주지 않는다(소켓은 "지금부터 오는 것"만 전달, DB를 스스로 뒤지지 않음). 두 축으로 해결한다.

- **영속**: `chat:send`는 **DB 저장을 먼저, 브로드캐스트를 나중에** 한다(4장). 서버가 죽어도 저장된 메시지는 남는다.
- **재동기화**: 프론트는 방에서 받은 **마지막 메시지의 `id`(autoincrement Int)를 보관**하고, 재연결 직후 `GET /chat-rooms/:id/messages?after=<마지막 id>`로 끊긴 동안 쌓인 메시지만 조회해 이어붙인다. `id`가 단조증가 정수라 "이 ID 이후"가 단순 `WHERE id > ?`가 된다 — 이것이 ChatMessage의 int PK 채택 이유다.

### 8.4 문제③ 미전송 — 프론트 재전송 큐

- `chat:send` 시 `clientMsgId`(프론트 생성)를 붙이고 메시지를 로컬 미확정 큐에 넣어 낙관적으로 렌더(pending)한다.
- 서버 `chat:ack{clientMsgId, id}`를 받으면 큐에서 제거하고 실제 `id`로 확정한다.
- 연결이 끊긴 채 보낸(미ack) 큐 항목은 재연결 시 자동 재전송한다. 서버는 `chat:message`에 `clientMsgId`를 되실어 보내 낙관적 렌더분과 중복을 제거한다.
- 큐는 인메모리로 둔다(새로고침 시 소실). 새로고침은 초기 내역을 DB에서 다시 불러오므로 유실 복구엔 문제없다. (sessionStorage 영속은 필요해지면 추가.)

### 8.5 읽음 흐름

- 방 진입 및 새 메시지 수신 시 `chat:read{ roomId, lastReadMessageId=방의 마지막 메시지 id }`를 보낸다 → 서버가 뷰어 역할에 맞는 `*LastReadMessageId`를 갱신하고 상대에게 브로드캐스트한다.
- 채팅 목록의 `unreadCount`와 헤더 안읽음 뱃지는 `id > 내 lastReadMessageId AND senderId != 나`로 집계한다.
