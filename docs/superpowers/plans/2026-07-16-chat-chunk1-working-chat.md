# 채팅 정상 동작 (덩어리 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 학생-코치 1:1 실시간 채팅이 정상 동작하게 만든다 — 방 생성/목록/히스토리 REST + socket.io 게이트웨이(저장 후 브로드캐스트) + 프론트 소켓 연결·UI·실시간 읽음·안읽음 뱃지. 유실 해결(덩어리 2~4)의 전제.

**Architecture:** 백엔드는 기존 NestJS 3층(module/controller/service) + socket.io 게이트웨이 1개. REST가 방 생성·조회·재동기화(`?after=`)를, 게이트웨이가 실시간 송수신·읽음을 맡는다. 메시지는 항상 DB 저장 먼저 → 방 브로드캐스트(순서 고정, 유실 방지 전제). 프론트는 FSD로 entities(SSR 조회)·features(액션·소켓 훅·Zustand 스토어·UI). 소켓은 라우트 전환에도 안 죽도록 Zustand 스토어에 1개 보관.

**Tech Stack:** NestJS 11, `@nestjs/websockets`+`@nestjs/platform-socket.io`+`socket.io`(설치됨), Prisma 7. Next.js 16 App Router, React 19, `socket.io-client`+`zustand`(설치됨), Vitest.

**설계 근거:** `docs/superpowers/specs/2026-07-16-chat-message-loss-recovery-design.md` 덩어리 1, `docs/SPEC.md` 2·4·5·8장.

**작업 규칙:**
- 커밋은 자주. 각 태스크 끝 커밋 메시지는 아래 지정.
- **프론트 코드 작성 전** `apps/web/node_modules/next/dist/docs/`의 관련 문서(클라이언트 컴포넌트·App Router 레이아웃) 확인 (AGENTS.md 규칙). `vercel-react-best-practices`·`frontend-code-style` 스킬 참고.
- BE 테스트 Jest(`pnpm --filter=@mulink/api test`), FE 테스트 Vitest(`pnpm --filter=@mulink/web test`).
- Prisma import는 `../../generated/prisma/client`. enum은 `../../generated/prisma/enums`.
- UI는 **최소 뼈대**(구분만). 시안 오면 교체하므로 로직과 분리해 작성.

---

## 파일 구조

**백엔드 (신규 `apps/api/src/chat/`)**
- `chat.module.ts` — `imports:[AuthModule]`, 컨트롤러·게이트웨이·서비스 등록
- `chat.controller.ts` — REST: 방 생성/목록/히스토리/재동기화
- `chat.service.ts` — 방·메시지 DB 로직 + 참여자 접근 검증
- `chat.gateway.ts` — socket.io 게이트웨이(인증·join·send·read)
- `dto/create-chat-room.dto.ts` — `{ proposalId }`
- 수정 `app.module.ts` — ChatModule 등록
- 수정 `lesson-request.service.ts` — `getMyLessonRequest` proposals에 `roomId` 추가

**프론트 (신규)**
- `entities/chat/chat.type.ts` — 방·메시지·목록 타입
- `entities/chat/chat.api.ts` — SSR 조회(`getMyChatRooms`, `getRoomMessages`)
- `features/chat/chat.action.ts` — `createChatRoomAction`
- `features/chat/store/chat-socket.store.ts` — Zustand: 소켓·연결상태·수신 메시지
- `features/chat/lib/merge-messages.ts` — 순수 함수(중복 제거 병합) + 테스트
- `features/chat/ui/ChatRoomList.tsx` / `ChatRoomView.tsx` / `MessageBubble.tsx` / `ConnectionStatus.tsx`
- `app/(chat)/layout.tsx` — 로그인 가드
- `app/(chat)/chat/page.tsx` — 목록
- `app/(chat)/chat/[roomId]/page.tsx` — 방
- 수정 `features/lesson-request/ui/my-request/CoachProfileDrawer.tsx` — 채팅 버튼
- 수정 `widgets/Header.tsx` — 채팅 진입 + 안읽음 뱃지
- 수정 `entities/lesson-request/lesson-request.type.ts` — `LessonProposal`에 `roomId`

---

## PART A — 백엔드

### Task A1: 채팅 서비스 — 방 생성/취득 + 참여자 검증

**Files:**
- Create: `apps/api/src/chat/chat.service.ts`
- Create: `apps/api/src/chat/dto/create-chat-room.dto.ts`
- Test: `apps/api/src/chat/chat.service.spec.ts`

- [ ] **Step 1: DTO 작성**

`apps/api/src/chat/dto/create-chat-room.dto.ts`:
```ts
export class CreateChatRoomDto {
  proposalId!: string;
}
```

- [ ] **Step 2: 실패 테스트 작성**

`apps/api/src/chat/chat.service.spec.ts` — 기존 서비스 spec이 없으므로 PrismaService를 목으로 주입. 핵심 3동작만 검증(멱등 생성, 참여자 아니면 Forbidden, 방 조회).

```ts
import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { ChatService } from './chat.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ChatService', () => {
  let service: ChatService;
  let prisma: {
    lessonProposal: { findUnique: jest.Mock };
    chatRoom: { findUnique: jest.Mock; create: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      lessonProposal: { findUnique: jest.fn() },
      chatRoom: { findUnique: jest.fn(), create: jest.fn() },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [ChatService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(ChatService);
  });

  // 학생이 자기 제안이 아닌 방을 열려 하면 막는다
  it('제안의 학생이 아니면 방 생성을 거부한다', async () => {
    prisma.lessonProposal.findUnique.mockResolvedValue({
      id: 'p1', coachId: 'coach1', request: { studentId: 'other-student' },
    });
    await expect(
      service.createOrGetRoom('me-student', { proposalId: 'p1' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  // 이미 방이 있으면 새로 만들지 않고 기존 방을 반환한다(멱등)
  it('이미 방이 있으면 기존 방을 반환한다', async () => {
    prisma.lessonProposal.findUnique.mockResolvedValue({
      id: 'p1', coachId: 'coach1', request: { studentId: 'me-student' },
    });
    prisma.chatRoom.findUnique.mockResolvedValue({ id: 'room1', proposalId: 'p1' });
    const room = await service.createOrGetRoom('me-student', { proposalId: 'p1' });
    expect(room.id).toBe('room1');
    expect(prisma.chatRoom.create).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `pnpm --filter=@mulink/api test -- chat.service`
Expected: FAIL (`ChatService` 없음 → 컴파일 에러)

- [ ] **Step 4: 서비스 구현**

`apps/api/src/chat/chat.service.ts`. 방 생성은 학생만 — 제안의 `request.studentId`가 호출자여야 함. `proposalId @unique`라 이미 있으면 기존 방 반환(멱등). 접근 검증 헬퍼는 A2·A3에서 재사용.

```ts
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateChatRoomDto } from './dto/create-chat-room.dto';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  // 채팅방 생성/취득 (학생만). 제안(학생-코치 쌍)당 방 1개 — 이미 있으면 기존 방 반환(멱등)
  async createOrGetRoom(userId: string, dto: CreateChatRoomDto) {
    // 1단계: 대상 제안 + 그 신청의 학생 조회 (방 개설 권한은 학생에게만)
    const proposal = await this.prisma.lessonProposal.findUnique({
      where: { id: dto.proposalId },
      include: { request: { select: { studentId: true } } },
    });
    if (!proposal) {
      throw new NotFoundException('레슨 제안을 찾을 수 없습니다.');
    }
    // 채팅 개시는 학생만 — 제안이 달린 신청의 주인이어야 함
    if (proposal.request.studentId !== userId) {
      throw new ForbiddenException('본인 신청의 제안에서만 채팅을 시작할 수 있습니다.');
    }

    // 2단계: 이미 방이 있으면 그대로 반환 (멱등)
    const existing = await this.prisma.chatRoom.findUnique({
      where: { proposalId: dto.proposalId },
    });
    if (existing) return existing;

    // 3단계: 새 방 생성 (학생 = 신청 주인, 코치 = 제안 발신자)
    return this.prisma.chatRoom.create({
      data: {
        proposalId: dto.proposalId,
        studentId: proposal.request.studentId,
        coachId: proposal.coachId,
      },
    });
  }

  // 내가 이 방의 당사자인지 검증하고 방을 반환 (아니면 예외) — 히스토리·소켓 접근 공용
  async getRoomForParticipant(userId: string, roomId: string) {
    const room = await this.prisma.chatRoom.findUnique({ where: { id: roomId } });
    if (!room) {
      throw new NotFoundException('채팅방을 찾을 수 없습니다.');
    }
    if (room.studentId !== userId && room.coachId !== userId) {
      throw new ForbiddenException('참여 중인 채팅방이 아닙니다.');
    }
    return room;
  }
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `pnpm --filter=@mulink/api test -- chat.service`
Expected: PASS (2 tests)

- [ ] **Step 6: 커밋**

```bash
git add apps/api/src/chat/
git commit -m "feat(chat): 채팅방 생성/취득 서비스 + 참여자 검증"
```

---

### Task A2: 메시지 서비스 — 저장 / 히스토리 / 재동기화 / 읽음

**Files:**
- Modify: `apps/api/src/chat/chat.service.ts`
- Test: `apps/api/src/chat/chat.service.spec.ts`

- [ ] **Step 1: 실패 테스트 추가**

`chat.service.spec.ts`의 `prisma` 목에 `chatMessage`와 `chatRoom.update`를 추가하고, 메시지 저장·재동기화 조회 테스트를 넣는다.

목 확장 (beforeEach의 prisma 객체에 추가):
```ts
    prisma = {
      lessonProposal: { findUnique: jest.fn() },
      chatRoom: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      chatMessage: { create: jest.fn(), findMany: jest.fn() },
    };
```
타입 선언도 함께 확장:
```ts
  let prisma: {
    lessonProposal: { findUnique: jest.Mock };
    chatRoom: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    chatMessage: { create: jest.Mock; findMany: jest.Mock };
  };
```

테스트 추가:
```ts
  // 재동기화는 주어진 id 초과 메시지만 id 오름차순으로 조회한다
  it('getMessagesAfter는 id > after 조건으로 조회한다', async () => {
    prisma.chatRoom.findUnique.mockResolvedValue({
      id: 'room1', studentId: 'me', coachId: 'coach1',
    });
    prisma.chatMessage.findMany.mockResolvedValue([{ id: 11 }, { id: 12 }]);
    const rows = await service.getMessagesAfter('me', 'room1', 10);
    expect(prisma.chatMessage.findMany).toHaveBeenCalledWith({
      where: { roomId: 'room1', id: { gt: 10 } },
      orderBy: { id: 'asc' },
    });
    expect(rows).toHaveLength(2);
  });

  // 메시지 저장은 방 참여자만 가능하고 senderId를 호출자로 고정한다
  it('saveMessage는 참여자만 저장하고 senderId를 호출자로 고정한다', async () => {
    prisma.chatRoom.findUnique.mockResolvedValue({
      id: 'room1', studentId: 'me', coachId: 'coach1',
    });
    prisma.chatMessage.create.mockResolvedValue({
      id: 1, roomId: 'room1', senderId: 'me', content: '안녕', createdAt: new Date(),
    });
    const msg = await service.saveMessage('me', 'room1', '안녕');
    expect(prisma.chatMessage.create).toHaveBeenCalledWith({
      data: { roomId: 'room1', senderId: 'me', content: '안녕' },
    });
    expect(msg.senderId).toBe('me');
  });
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter=@mulink/api test -- chat.service`
Expected: FAIL (`getMessagesAfter`/`saveMessage` 없음)

- [ ] **Step 3: 서비스 메서드 구현**

`chat.service.ts`에 추가 (클래스 안, `getRoomForParticipant` 재사용):

```ts
  // 방 초기 내역 — 전체를 id 오름차순으로 (MVP: 페이지네이션 없음)
  async getMessages(userId: string, roomId: string) {
    await this.getRoomForParticipant(userId, roomId);
    return this.prisma.chatMessage.findMany({
      where: { roomId },
      orderBy: { id: 'asc' },
    });
  }

  // 재동기화 — 이 id 초과 메시지만 (끊긴 사이 쌓인 것). id가 단조증가라 WHERE id > ?
  async getMessagesAfter(userId: string, roomId: string, afterId: number) {
    await this.getRoomForParticipant(userId, roomId);
    return this.prisma.chatMessage.findMany({
      where: { roomId, id: { gt: afterId } },
      orderBy: { id: 'asc' },
    });
  }

  // 메시지 저장 (소켓 chat:send에서 호출) — 저장이 브로드캐스트보다 먼저 와야 유실 방지
  async saveMessage(userId: string, roomId: string, content: string) {
    await this.getRoomForParticipant(userId, roomId);
    return this.prisma.chatMessage.create({
      data: { roomId, senderId: userId, content },
    });
  }

  // 읽음 커서 갱신 — 뷰어 역할(student/coach)에 맞는 컬럼을 올린다
  async markRead(userId: string, roomId: string, lastReadMessageId: number) {
    const room = await this.getRoomForParticipant(userId, roomId);
    const field =
      room.studentId === userId
        ? 'studentLastReadMessageId'
        : 'coachLastReadMessageId';
    await this.prisma.chatRoom.update({
      where: { id: roomId },
      data: { [field]: lastReadMessageId },
    });
    return { roomId, lastReadMessageId, readerId: userId };
  }
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter=@mulink/api test -- chat.service`
Expected: PASS (4 tests)

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src/chat/
git commit -m "feat(chat): 메시지 저장·히스토리·재동기화·읽음 서비스"
```

---

### Task A3: 채팅 목록 서비스 (partner·lastMessage·unreadCount nested)

**Files:**
- Modify: `apps/api/src/chat/chat.service.ts`
- Test: `apps/api/src/chat/chat.service.spec.ts`

- [ ] **Step 1: 실패 테스트 추가**

목록은 내가 학생이거나 코치인 방 전부. 각 방에 상대 표시정보·마지막 메시지·안읽음 수를 붙인다. 안읽음 = `id > 내 lastRead AND senderId != 나`.

목에 추가 (beforeEach prisma 확장):
```ts
      chatRoom: {
        findUnique: jest.fn(), create: jest.fn(), update: jest.fn(),
        findMany: jest.fn(),
      },
      chatMessage: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
```
타입 선언도 `findMany`/`count` 반영.

테스트:
```ts
  // 목록의 각 방에 상대·마지막 메시지·안읽음 수를 붙인다
  it('getMyRooms는 방마다 partner·lastMessage·unreadCount를 붙인다', async () => {
    prisma.chatRoom.findMany.mockResolvedValue([
      {
        id: 'room1', studentId: 'me', coachId: 'coach1',
        studentLastReadMessageId: 5, coachLastReadMessageId: null,
        createdAt: new Date(),
        coach: { nickname: '코치닉', coachProfile: { activityName: '코치A', imageUrl: null } },
        student: { nickname: '학생닉' },
        messages: [{ id: 8, content: '마지막', createdAt: new Date(), senderId: 'coach1' }],
      },
    ]);
    prisma.chatMessage.count.mockResolvedValue(3);

    const rooms = await service.getMyRooms('me');
    expect(rooms[0].partner.name).toBe('코치A'); // 내가 학생이면 상대는 코치
    expect(rooms[0].lastMessage?.content).toBe('마지막');
    expect(rooms[0].unreadCount).toBe(3);
    // 안읽음 집계: id > 내 lastRead(5) AND senderId != 나(me)
    expect(prisma.chatMessage.count).toHaveBeenCalledWith({
      where: { roomId: 'room1', id: { gt: 5 }, senderId: { not: 'me' } },
    });
  });
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter=@mulink/api test -- chat.service`
Expected: FAIL (`getMyRooms` 없음)

- [ ] **Step 3: 구현**

`chat.service.ts`에 추가. 내가 학생/코치인 방을 최근 대화순으로. 상대 표시정보는 내 역할의 반대편. 코치 표시명은 `coachProfile.activityName`(없으면 nickname 폴백), 학생은 nickname.

```ts
  // 내 채팅방 목록 — 각 방에 상대 표시정보·마지막 메시지·안읽음 수 (화면 지향)
  async getMyRooms(userId: string) {
    const rooms = await this.prisma.chatRoom.findMany({
      where: { OR: [{ studentId: userId }, { coachId: userId }] },
      include: {
        coach: {
          select: {
            nickname: true,
            coachProfile: { select: { activityName: true, imageUrl: true } },
          },
        },
        student: { select: { nickname: true } },
        messages: { orderBy: { id: 'desc' }, take: 1 }, // 마지막 메시지 1건
      },
    });

    // 방마다 안읽음 수를 병렬 집계 후 응답 형태로 평탄화
    const withMeta = await Promise.all(
      rooms.map(async (room) => {
        const iAmStudent = room.studentId === userId;
        const myLastRead = iAmStudent
          ? room.studentLastReadMessageId
          : room.coachLastReadMessageId;
        const unreadCount = await this.prisma.chatMessage.count({
          where: {
            roomId: room.id,
            id: { gt: myLastRead ?? 0 },
            senderId: { not: userId },
          },
        });
        const last = room.messages[0] ?? null;
        return {
          id: room.id,
          partner: iAmStudent
            ? {
                name: room.coach.coachProfile?.activityName ?? room.coach.nickname,
                imageUrl: room.coach.coachProfile?.imageUrl ?? null,
              }
            : { name: room.student.nickname, imageUrl: null },
          lastMessage: last
            ? { content: last.content, createdAt: last.createdAt }
            : null,
          unreadCount,
          createdAt: room.createdAt,
        };
      }),
    );

    // 최근 대화순 — 마지막 메시지 시각 우선, 없으면 방 생성 시각
    return withMeta.sort((a, b) => {
      const at = a.lastMessage?.createdAt ?? a.createdAt;
      const bt = b.lastMessage?.createdAt ?? b.createdAt;
      return new Date(bt).getTime() - new Date(at).getTime();
    });
  }
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter=@mulink/api test -- chat.service`
Expected: PASS (5 tests)

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src/chat/
git commit -m "feat(chat): 내 채팅방 목록 서비스 (상대·마지막메시지·안읽음)"
```

---

### Task A4: 채팅 컨트롤러 (REST) + 모듈 등록

**Files:**
- Create: `apps/api/src/chat/chat.controller.ts`
- Create: `apps/api/src/chat/chat.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: 컨트롤러 작성**

기존 패턴(`lesson-proposal.controller.ts`): 클래스 레벨 `@UseGuards(SupabaseAuthGuard)`, `req.user.id`. 재동기화는 `@Query('after')` 유무로 분기.

`apps/api/src/chat/chat.controller.ts`:
```ts
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ChatService } from './chat.service';
import type { CreateChatRoomDto } from './dto/create-chat-room.dto';

type AuthedRequest = { user: SupabaseUser };

@Controller('chat-rooms')
@UseGuards(SupabaseAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // 채팅방 생성/취득 (학생만) — 멱등
  @Post()
  async createRoom(@Req() req: AuthedRequest, @Body() dto: CreateChatRoomDto) {
    return this.chatService.createOrGetRoom(req.user.id, dto);
  }

  // 내 채팅방 목록
  @Get()
  async getMyRooms(@Req() req: AuthedRequest) {
    return this.chatService.getMyRooms(req.user.id);
  }

  // 방 메시지 — after 있으면 재동기화(그 id 초과분만), 없으면 초기 내역 전체
  @Get(':id/messages')
  async getMessages(
    @Req() req: AuthedRequest,
    @Param('id') roomId: string,
    @Query('after') after?: string,
  ) {
    if (after !== undefined) {
      return this.chatService.getMessagesAfter(
        req.user.id,
        roomId,
        Number.parseInt(after, 10),
      );
    }
    return this.chatService.getMessages(req.user.id, roomId);
  }
}
```

- [ ] **Step 2: 모듈 작성 + 등록**

`apps/api/src/chat/chat.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  imports: [AuthModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
```

`app.module.ts` imports에 `ChatModule` 추가 (import 문 + imports 배열 둘 다).

- [ ] **Step 3: 타입체크 + 기존 테스트 통과 확인**

Run: `pnpm --filter=@mulink/api check-types && pnpm --filter=@mulink/api test`
Expected: 타입 OK, 전체 테스트 PASS

- [ ] **Step 4: 서버 기동 확인**

Run: `pnpm --filter=@mulink/api build`
Expected: 빌드 성공 (게이트웨이는 아직 없지만 REST 라우트는 등록됨)

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src/chat/ apps/api/src/app.module.ts
git commit -m "feat(chat): 채팅 REST 컨트롤러 + ChatModule 등록"
```

---

### Task A5: socket.io 게이트웨이 (인증·join·send·read)

**Files:**
- Create: `apps/api/src/chat/chat.gateway.ts`
- Modify: `apps/api/src/chat/chat.module.ts`

> **참고 문서**: 작성 전 socket.io 최신 공식문서에서 `@nestjs/websockets`의 `@WebSocketGateway`·`@SubscribeMessage`·`handleConnection` 시그니처를 확인. socket.io 서버는 기본 `/socket.io` 경로로 붙는다.

- [ ] **Step 1: 게이트웨이 작성**

핵심: 핸드셰이크 1회 인증(`SupabaseService.getUser`), `chat:send`는 **저장 먼저 → 브로드캐스트**, `chat:message`에 `clientMsgId` 되실음, `chat:ack`는 발신자에게. 방은 socket.io room(`roomId`)으로.

`apps/api/src/chat/chat.gateway.ts`:
```ts
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  type OnGatewayConnection,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { SupabaseService } from '../auth/supabase.service';
import { ChatService } from './chat.service';

// HTTP enableCors는 소켓에 안 걸리므로 게이트웨이에서 직접 CORS 지정
@WebSocketGateway({
  cors: {
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection {
  @WebSocketServer() server!: Server;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly chatService: ChatService,
  ) {}

  // 핸드셰이크에서 토큰 1회 검증 → socket.data.user에 심고, 실패 시 연결 끊음
  async handleConnection(socket: Socket) {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      socket.disconnect();
      return;
    }
    const { data, error } = await this.supabase.getUser(token);
    if (error || !data?.user) {
      socket.disconnect();
      return;
    }
    socket.data.user = data.user;
  }

  private userId(socket: Socket): string {
    return (socket.data.user as { id: string }).id;
  }

  // 방 입장 — 참여자 대조 후 socket.io room 조인
  @SubscribeMessage('chat:join')
  async onJoin(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { roomId: string },
  ) {
    await this.chatService.getRoomForParticipant(this.userId(socket), body.roomId);
    await socket.join(body.roomId);
  }

  // 메시지 전송 — DB 저장 먼저 → 방 브로드캐스트(순서 고정: 저장돼야 재배포 유실 방지)
  @SubscribeMessage('chat:send')
  async onSend(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { roomId: string; content: string; clientMsgId: string },
  ) {
    const saved = await this.chatService.saveMessage(
      this.userId(socket),
      body.roomId,
      body.content,
    );
    // 방 전원에게 새 메시지 (clientMsgId 되실어 발신자 낙관 렌더분 중복 제거)
    this.server.to(body.roomId).emit('chat:message', {
      id: saved.id,
      roomId: saved.roomId,
      senderId: saved.senderId,
      content: saved.content,
      createdAt: saved.createdAt,
      clientMsgId: body.clientMsgId,
    });
    // 발신자에게 ack — 미전송 큐 확정 제거용
    socket.emit('chat:ack', { clientMsgId: body.clientMsgId, id: saved.id });
  }

  // 읽음 — 뷰어 커서 갱신 → 상대에게 읽음 위치 브로드캐스트(실시간 읽음 표시)
  @SubscribeMessage('chat:read')
  async onRead(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { roomId: string; lastReadMessageId: number },
  ) {
    const result = await this.chatService.markRead(
      this.userId(socket),
      body.roomId,
      body.lastReadMessageId,
    );
    this.server.to(body.roomId).emit('chat:read', result);
  }
}
```

- [ ] **Step 2: 모듈에 게이트웨이 등록**

`chat.module.ts`의 `providers`에 `ChatGateway` 추가 (import 문도).

- [ ] **Step 3: 빌드 + 타입체크**

Run: `pnpm --filter=@mulink/api check-types && pnpm --filter=@mulink/api build`
Expected: 성공

- [ ] **Step 4: 수동 연결 스모크 (선택, 로컬 서버 실행 중일 때)**

Run: `pnpm --filter=@mulink/api dev` 후 별도 터미널에서
`curl -sS 'http://localhost:4000/socket.io/?EIO=4&transport=polling'` → socket.io 핸드셰이크 응답(`0{...}`)이 오면 게이트웨이가 붙은 것.

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src/chat/
git commit -m "feat(chat): socket.io 게이트웨이 (인증·join·send·read)"
```

---

### Task A6: `getMyLessonRequest`에 roomId 추가

**Files:**
- Modify: `apps/api/src/lesson-request/lesson-request.service.ts:44-78`

- [ ] **Step 1: 실패 테스트 (없으면 생략 가능 — 기존 spec 유무 확인)**

`lesson-request.service.spec.ts`가 있으면 roomId 매핑 케이스 추가. 없으면 이 태스크는 구현+수동확인으로 진행(기존에 서비스 spec 부재).

- [ ] **Step 2: 구현 — 각 proposal에 roomId 매핑**

`getMyLessonRequest`를 수정. proposals의 `coach.chatRoom`을 함께 조회해(해당 제안의 방) 평탄화 시 `roomId`를 붙인다. ChatRoom은 `proposalId @unique`라 proposal→chatRoom이 0/1.

기존 include의 proposals select에 `chatRoom` 추가:
```ts
        proposals: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            message: true,
            createdAt: true,
            chatRoom: { select: { id: true } }, // 이 제안으로 열린 방(있으면)
            coach: {
              select: {
                coachProfile: {
                  select: { activityName: true, imageUrl: true, region: true },
                },
              },
            },
          },
        },
```

평탄화에 roomId 추가:
```ts
      proposals: request.proposals.map((proposal) => ({
        id: proposal.id,
        message: proposal.message,
        createdAt: proposal.createdAt,
        coachProfile: proposal.coach.coachProfile,
        roomId: proposal.chatRoom?.id ?? null, // 방 있으면 그 id, 없으면 null
      })),
```

- [ ] **Step 3: 타입체크 + 테스트**

Run: `pnpm --filter=@mulink/api check-types && pnpm --filter=@mulink/api test`
Expected: 성공

- [ ] **Step 4: 커밋**

```bash
git add apps/api/src/lesson-request/lesson-request.service.ts
git commit -m "feat(chat): 학생 제안 응답에 roomId 추가 (채팅하기/이어하기 구분)"
```

---

## PART B — 프론트엔드

> 각 태스크 착수 전 `apps/web/node_modules/next/dist/docs/`의 관련 문서 확인.

### Task B1: 채팅 타입 + SSR 조회 (entities/chat)

**Files:**
- Create: `apps/web/src/entities/chat/chat.type.ts`
- Create: `apps/web/src/entities/chat/chat.api.ts`

- [ ] **Step 1: 타입 작성**

백엔드 응답과 1:1. `ChatMessage.id`는 number 주의.

`apps/web/src/entities/chat/chat.type.ts`:
```ts
// 채팅 메시지 1건. 백엔드 GET /chat-rooms/:id/messages 응답과 1:1.
// id는 자동증가 정수(재동기화 커서)라 number.
export type ChatMessage = {
  id: number;
  roomId: string;
  senderId: string;
  content: string;
  createdAt: string; // JSON 직렬화 ISO
};

// 채팅 목록의 방 1건. 백엔드 GET /chat-rooms 응답과 1:1.
export type ChatRoomSummary = {
  id: string;
  partner: { name: string; imageUrl: string | null };
  lastMessage: { content: string; createdAt: string } | null;
  unreadCount: number;
  createdAt: string;
};
```

- [ ] **Step 2: SSR 조회 작성**

기존 `lesson-request.api.ts` 패턴 그대로(`server-only`, `cache()`, Bearer, `no-store`).

`apps/web/src/entities/chat/chat.api.ts`:
```ts
import 'server-only';
import { cache } from 'react';
import { createClient } from '@/shared/lib/supabase/server';
import type { ChatMessage, ChatRoomSummary } from './chat.type';

// 내 채팅방 목록 (SSR 초기 렌더). 비로그인/오류면 빈 배열.
export const getMyChatRooms = cache(async (): Promise<ChatRoomSummary[]> => {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) return [];

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/chat-rooms`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!response.ok) return [];
  return (await response.json()) as ChatRoomSummary[];
});

// 방 초기 내역 (SSR). 접근 불가/오류면 빈 배열.
export const getRoomMessages = cache(
  async (roomId: string): Promise<ChatMessage[]> => {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token;
    if (!accessToken) return [];

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/chat-rooms/${roomId}/messages`,
      { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' },
    );
    if (!response.ok) return [];
    return (await response.json()) as ChatMessage[];
  },
);
```

- [ ] **Step 3: 타입체크**

Run: `pnpm --filter=@mulink/web check-types`
Expected: 성공

- [ ] **Step 4: 커밋**

```bash
git add apps/web/src/entities/chat/
git commit -m "feat(chat): 채팅 타입 + SSR 조회 (entities/chat)"
```

---

### Task B2: 메시지 병합 순수 함수 + 테스트 (Vitest)

**Files:**
- Create: `apps/web/src/features/chat/lib/merge-messages.ts`
- Test: `apps/web/src/features/chat/lib/merge-messages.test.ts`

> 소켓 수신·재동기화 병합의 핵심 로직을 소켓과 분리해 순수 함수로. 덩어리 3(재동기화·큐)에서 재사용.

- [ ] **Step 1: 실패 테스트 작성**

`merge-messages.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { mergeMessages } from './merge-messages';
import type { ChatMessage } from '@/entities/chat/chat.type';

const msg = (id: number): ChatMessage => ({
  id, roomId: 'r', senderId: 's', content: `m${id}`, createdAt: '2026-01-01',
});

describe('mergeMessages', () => {
  // 같은 id는 한 번만, id 오름차순으로 정렬
  it('중복 id를 제거하고 id 오름차순으로 병합한다', () => {
    const result = mergeMessages([msg(1), msg(2)], [msg(2), msg(3)]);
    expect(result.map((m) => m.id)).toEqual([1, 2, 3]);
  });

  // 빈 유입은 원본 유지
  it('유입이 비면 기존을 그대로 반환한다', () => {
    const result = mergeMessages([msg(1)], []);
    expect(result.map((m) => m.id)).toEqual([1]);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter=@mulink/web test -- merge-messages`
Expected: FAIL (`mergeMessages` 없음)

- [ ] **Step 3: 구현**

`merge-messages.ts`:
```ts
import type { ChatMessage } from '@/entities/chat/chat.type';

// 기존 메시지와 새로 받은 메시지를 id 기준 중복 제거하며 오름차순 병합.
// 소켓 실시간 수신·재연결 재동기화 양쪽에서 같은 규칙으로 합치기 위한 순수 함수.
export function mergeMessages(
  existing: ChatMessage[],
  incoming: ChatMessage[],
): ChatMessage[] {
  const byId = new Map<number, ChatMessage>();
  for (const m of existing) byId.set(m.id, m);
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.id - b.id);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter=@mulink/web test -- merge-messages`
Expected: PASS (2 tests)

- [ ] **Step 5: 커밋**

```bash
git add apps/web/src/features/chat/lib/
git commit -m "feat(chat): 메시지 중복 제거 병합 순수 함수 + 테스트"
```

---

### Task B3: Zustand 소켓 스토어

**Files:**
- Create: `apps/web/src/features/chat/store/chat-socket.store.ts`

> 소켓 1개를 라우트 전환에도 유지하려 Zustand 전역 스토어에 보관. 소켓 생성은 `connect()` 액션에서만(컴포넌트 `useEffect`가 호출). 덩어리 3에서 재연결 옵션·미전송 큐가 이 스토어에 추가됨 — 지금은 연결·수신·전송만.

- [ ] **Step 1: Zustand·socket.io-client 최신 사용법 확인**

zustand v5, socket.io-client v4 공식문서에서 `create` 시그니처와 `io(url, { auth })` 옵션 확인.

- [ ] **Step 2: 스토어 작성**

`apps/web/src/features/chat/store/chat-socket.store.ts`:
```ts
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
```

- [ ] **Step 3: 타입체크**

Run: `pnpm --filter=@mulink/web check-types`
Expected: 성공

- [ ] **Step 4: 커밋**

```bash
git add apps/web/src/features/chat/store/
git commit -m "feat(chat): Zustand 소켓 스토어 (연결·수신·전송·읽음)"
```

---

### Task B4: 방 생성 서버 액션

**Files:**
- Create: `apps/web/src/features/chat/chat.action.ts`

- [ ] **Step 1: 액션 작성**

기존 `lesson-register.action.ts` 패턴. 성공 시 roomId 반환(라우팅용).

`apps/web/src/features/chat/chat.action.ts`:
```ts
'use server';

import { createClient } from '@/shared/lib/supabase/server';

// 제안에서 채팅방 생성/취득 (멱등). 성공 시 roomId 반환.
export async function createChatRoomAction(
  proposalId: string,
): Promise<{ roomId: string } | { error: string }> {
  const supabase = await createClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) return { error: '로그인이 필요합니다.' };

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/chat-rooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ proposalId }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    return { error: body.message ?? '채팅방을 열 수 없습니다.' };
  }
  const room = (await response.json()) as { id: string };
  return { roomId: room.id };
}
```

- [ ] **Step 2: 타입체크 + 커밋**

Run: `pnpm --filter=@mulink/web check-types`
```bash
git add apps/web/src/features/chat/chat.action.ts
git commit -m "feat(chat): 채팅방 생성 서버 액션"
```

---

### Task B5: UI 뼈대 컴포넌트 (최소)

**Files:**
- Create: `apps/web/src/features/chat/ui/MessageBubble.tsx`
- Create: `apps/web/src/features/chat/ui/ConnectionStatus.tsx`
- Create: `apps/web/src/features/chat/ui/ChatRoomView.tsx`
- Create: `apps/web/src/features/chat/ui/ChatRoomList.tsx`

> **최소 뼈대** — 좌우 구분·시각·읽음표시·연결상태만. 스타일은 Tailwind 최소. 시안 오면 이 파일들만 교체.

- [ ] **Step 1: MessageBubble (내/상대 좌우 구분 + 읽음 표시)**

```tsx
import { toRelativeTime } from '@/shared/lib/relative-time';
import type { ChatMessage } from '@/entities/chat/chat.type';

type Props = { message: ChatMessage; isMine: boolean; readByPartner: boolean };

export function MessageBubble({ message, isMine, readByPartner }: Props) {
  return (
    <div className={isMine ? 'flex justify-end' : 'flex justify-start'}>
      <div className="max-w-[70%] rounded-lg bg-(--neutral-100) px-3 py-2">
        <p className="text-sm text-(--neutral-800)">{message.content}</p>
        <div className="mt-1 flex gap-1 text-xs text-(--neutral-400)">
          <span>{toRelativeTime(message.createdAt)}</span>
          {isMine && readByPartner && <span>읽음</span>}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: ConnectionStatus**

```tsx
export function ConnectionStatus({ connected }: { connected: boolean }) {
  if (connected) return null;
  return (
    <div className="bg-(--neutral-100) py-1 text-center text-xs text-(--neutral-500)">
      연결이 끊겨 재연결 중…
    </div>
  );
}
```

- [ ] **Step 3: ChatRoomView (방 화면 — 소켓 연결·전송·읽음·최신 스크롤)**

`'use client'`. 초기 내역은 서버에서 prop으로 받음. 마운트 시 `connect`→`joinRoom`, 새 메시지/진입 시 `markRead`, 언마운트 시 정리하지 않음(소켓은 전역 유지, 방만 나감). 최신으로 스크롤.

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { useChatSocket } from '../store/chat-socket.store';
import { MessageBubble } from './MessageBubble';
import { ConnectionStatus } from './ConnectionStatus';
import type { ChatMessage } from '@/entities/chat/chat.type';

type Props = { roomId: string; myId: string; initialMessages: ChatMessage[] };

export function ChatRoomView({ roomId, myId, initialMessages }: Props) {
  const { connected, messages, read, connect, joinRoom, sendMessage, markRead } =
    useChatSocket();
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
  }, [roomId]); // roomId 바뀌면 재입장

  // 새 메시지 도착·진입 시 최신으로 스크롤 + 읽음 처리
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
    const last = messages.at(-1);
    if (last) markRead(roomId, last.id);
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
          <p className="text-center text-sm text-(--neutral-400)">대화를 시작해보세요</p>
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
```

- [ ] **Step 4: ChatRoomList (목록 뼈대)**

```tsx
import Link from 'next/link';
import { toRelativeTime } from '@/shared/lib/relative-time';
import type { ChatRoomSummary } from '@/entities/chat/chat.type';

export function ChatRoomList({ rooms }: { rooms: ChatRoomSummary[] }) {
  if (rooms.length === 0) {
    return <p className="p-6 text-center text-sm text-(--neutral-400)">참여 중인 채팅방이 없습니다</p>;
  }
  return (
    <ul className="divide-y divide-(--neutral-100)">
      {rooms.map((room) => (
        <li key={room.id}>
          <Link href={`/chat/${room.id}`} className="flex items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-(--neutral-800)">{room.partner.name}</p>
              <p className="truncate text-xs text-(--neutral-400)">
                {room.lastMessage?.content ?? '대화 없음'}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              {room.lastMessage && (
                <span className="text-xs text-(--neutral-400)">
                  {toRelativeTime(room.lastMessage.createdAt)}
                </span>
              )}
              {room.unreadCount > 0 && (
                <span className="rounded-full bg-(--green-600) px-1.5 text-xs text-white">
                  {room.unreadCount}
                </span>
              )}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 5: 타입체크 + 커밋**

Run: `pnpm --filter=@mulink/web check-types`
```bash
git add apps/web/src/features/chat/ui/
git commit -m "feat(chat): 채팅 UI 뼈대 (버블·목록·방·연결상태)"
```

---

### Task B6: (chat) 라우트 그룹 + 페이지

**Files:**
- Create: `apps/web/src/app/(chat)/layout.tsx`
- Create: `apps/web/src/app/(chat)/chat/page.tsx`
- Create: `apps/web/src/app/(chat)/chat/[roomId]/page.tsx`

> 착수 전 `node_modules/next/dist/docs/`에서 App Router layout·dynamic route(`[param]`)·`params` 접근 방식 확인 (Next.js 16은 `params`가 Promise일 수 있음).

- [ ] **Step 1: layout (로그인 가드만)**

`(student)/layout.tsx`에서 role 줄만 뺀 형태.
```tsx
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/entities/user/user.api';

export default async function ChatLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  if (!user) return redirect('/'); // 채팅은 학생·코치 공용, 로그인만 가드
  return children;
}
```

- [ ] **Step 2: 목록 페이지**

```tsx
import { getMyChatRooms } from '@/entities/chat/chat.api';
import { ChatRoomList } from '@/features/chat/ui/ChatRoomList';

export default async function ChatListPage() {
  const rooms = await getMyChatRooms();
  return (
    <main className="mx-auto max-w-xl">
      <h1 className="p-4 text-lg font-semibold">채팅</h1>
      <ChatRoomList rooms={rooms} />
    </main>
  );
}
```

- [ ] **Step 3: 방 페이지 (params 처리 주의)**

Next.js 16 `params` 접근 방식을 문서로 확인 후 작성. Promise면 `await params`.
```tsx
import { getRoomMessages } from '@/entities/chat/chat.api';
import { getCurrentUser } from '@/entities/user/user.api';
import { ChatRoomView } from '@/features/chat/ui/ChatRoomView';

export default async function ChatRoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  const [messages, user] = await Promise.all([
    getRoomMessages(roomId),
    getCurrentUser(),
  ]);
  if (!user) return null; // layout이 이미 가드하지만 타입 안전용

  return (
    <main className="mx-auto flex h-[calc(100dvh-3.5rem)] max-w-xl flex-col">
      <ChatRoomView roomId={roomId} myId={user.id} initialMessages={messages} />
    </main>
  );
}
```

- [ ] **Step 4: 빌드 확인**

Run: `pnpm --filter=@mulink/web build`
Expected: 성공 (라우트 3개 생성)

- [ ] **Step 5: 커밋**

```bash
git add "apps/web/src/app/(chat)/"
git commit -m "feat(chat): (chat) 라우트 그룹 + 목록·방 페이지"
```

---

### Task B7: CoachProfileDrawer 채팅 버튼 교체

**Files:**
- Modify: `apps/web/src/features/lesson-request/ui/my-request/CoachProfileDrawer.tsx`
- Modify: `apps/web/src/entities/lesson-request/lesson-request.type.ts:48-57`
- Test: `apps/web/src/features/lesson-request/ui/my-request/CoachProfileDrawer.test.tsx` (있으면 갱신)

- [ ] **Step 1: 타입에 roomId 추가**

`lesson-request.type.ts`의 `LessonProposal`에 `roomId: string | null` 추가:
```ts
export type LessonProposal = {
  id: string;
  message: string;
  createdAt: string;
  roomId: string | null; // 이 코치와의 채팅방 있으면 그 id, 없으면 null
  coachProfile: {
    activityName: string;
    imageUrl: string | null;
    region: Region;
  };
};
```

- [ ] **Step 2: 버튼 교체**

`CoachProfileDrawer.tsx`를 `'use client'` 유지. 카톡 버튼을 채팅 버튼으로. `roomId`가 있으면 "채팅 계속하기" → 바로 이동, 없으면 "채팅하기" → 액션으로 방 생성 후 이동. `useRouter`·`useTransition` 사용.

import 추가:
```tsx
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { createChatRoomAction } from '@/features/chat/chat.action';
```

컴포넌트 본문 상단(`return` 위)에:
```tsx
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // 채팅 버튼 핸들러 — 방 있으면 바로, 없으면 생성 후 이동
  const handleChat = () => {
    if (!offer) return;
    if (offer.roomId) {
      router.push(`/chat/${offer.roomId}`);
      return;
    }
    startTransition(async () => {
      const result = await createChatRoomAction(offer.id);
      if ('roomId' in result) router.push(`/chat/${result.roomId}`);
    });
  };
```

DrawerFooter의 Button 교체:
```tsx
            <DrawerFooter className="gap-2 p-6 pt-4">
              <Button
                variant="default"
                size="default"
                loading={pending}
                leftIcon={<MessageCircle size={20} aria-hidden="true" />}
                onClick={handleChat}>
                {offer.roomId ? '채팅 계속하기' : '채팅하기'}
              </Button>
            </DrawerFooter>
```

- [ ] **Step 3: 테스트 갱신**

`CoachProfileDrawer.test.tsx`가 있으면 카톡 버튼 문구 검증을 "채팅하기"로 갱신하고, `offer`에 `roomId` 필드를 채운다. `next/navigation`·`createChatRoomAction`은 `vi.mock`으로 목.

- [ ] **Step 4: 테스트 + 타입체크**

Run: `pnpm --filter=@mulink/web test -- CoachProfileDrawer && pnpm --filter=@mulink/web check-types`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add apps/web/src/features/lesson-request/ apps/web/src/entities/lesson-request/lesson-request.type.ts
git commit -m "feat(chat): 코치 드로어 카톡 버튼 → 채팅하기/이어하기로 교체"
```

---

### Task B8: Header 채팅 진입 + 안읽음 뱃지

**Files:**
- Modify: `apps/web/src/widgets/Header.tsx`
- Create: `apps/web/src/entities/chat/chat.api.ts` (getUnreadTotal 추가 — 같은 파일에)

> 뱃지는 **새로고침 갱신**(실시간 아님, 확정된 4-A). Header가 서버 컴포넌트라 `await`로 총 안읽음 수 조회.

- [ ] **Step 1: 총 안읽음 수 조회 추가**

`chat.api.ts`에 추가 — 목록의 unreadCount 합. 별도 엔드포인트 없이 기존 `getMyChatRooms` 재사용.
```ts
// 헤더 뱃지용 총 안읽음 수 (새로고침 시 갱신). 목록의 unreadCount 합.
export const getUnreadTotal = cache(async (): Promise<number> => {
  const rooms = await getMyChatRooms();
  return rooms.reduce((sum, r) => sum + r.unreadCount, 0);
});
```

- [ ] **Step 2: Header에 채팅 메뉴 + 뱃지**

`Header.tsx`에서 `getUnreadTotal` 호출, 드롭다운 공통 영역(role 분기 밖, 로그아웃 위)에 채팅 진입 추가. 뱃지는 총합 > 0일 때 트리거 아바타 근처 + 메뉴 항목에 표시.

import·조회 추가:
```tsx
import { getUnreadTotal } from '@/entities/chat/chat.api';
import { Badge } from '@/shared/ui/badge/badge';
```
```tsx
export async function Header() {
  const user = await getCurrentUser();
  const unread = user ? await getUnreadTotal() : 0;
```

트리거 버튼에 뱃지(아바타 우상단), 드롭다운에 채팅 항목(로그아웃 form 위, `DropdownMenuSeparator` 뒤):
```tsx
                <DropdownMenuItem asChild>
                  <Link href="/chat">
                    채팅{unread > 0 && <Badge variant="brand" className="ml-auto">{unread}</Badge>}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
```

트리거 아바타 뱃지(로그인 시, 있을 때만) — 트리거 `<button>` 안 Avatar 옆에:
```tsx
                  {unread > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-(--green-600)" />
                  )}
```
(트리거 button에 `relative` 클래스 추가 필요.)

- [ ] **Step 3: 빌드 + 타입체크**

Run: `pnpm --filter=@mulink/web check-types && pnpm --filter=@mulink/web build`
Expected: 성공

- [ ] **Step 4: 커밋**

```bash
git add apps/web/src/widgets/Header.tsx apps/web/src/entities/chat/chat.api.ts
git commit -m "feat(chat): 헤더 채팅 진입 + 안읽음 뱃지(새로고침 갱신)"
```

---

## PART C — 통합 검증 (덩어리 1 완료 판정)

### Task C1: 로컬 2계정 수동 E2E

- [ ] **Step 1: 로컬 실행**

Run: 루트에서 `pnpm dev` (web+api 동시). api는 로컬 `.env`(DATABASE_URL·SUPABASE 등) 필요.

- [ ] **Step 2: 시나리오 확인 (두 브라우저 프로필/시크릿창)**

- 학생 계정: `/student/lesson-request`에서 코치 제안 드로어 열기 → "채팅하기" → `/chat/:roomId` 진입
- 코치 계정: `/chat` 목록에 방 표시 → 진입
- 양쪽에서 메시지 전송 → **상대 화면에 실시간 도착**
- 한쪽 새로고침 → **히스토리 유지**(DB 영속 확인)
- 상대가 방을 열면 → **내 화면 메시지에 "읽음" 실시간 표시**
- 메시지 받은 뒤 헤더 → 새로고침 시 **안읽음 뱃지 반영**, 방 진입 후 새로고침 시 뱃지 사라짐

- [ ] **Step 3: 전체 테스트·타입·빌드 그린 확인**

Run: `pnpm --filter=@mulink/api test && pnpm --filter=@mulink/web test && pnpm check-types && pnpm build`
Expected: 전부 성공

- [ ] **Step 4: RESUME_STEP.md 갱신 (gitignore라 로컬만)**

6단계 "기능 개발" 체크박스(스키마 제외 나머지)를 완료로. 달라진 점 있으면 메모.

---

## Self-Review 결과

- **스펙 커버리지**: SPEC 4장 chat REST 4개(방생성/목록/히스토리/재동기화) → A1·A2·A4. 게이트웨이 이벤트 5개(join/send/message/ack/read) → A5. roomId 추가 → A6. FE entities/features/라우트/드로어/헤더 → B1~B8. 읽음 실시간(1-B) → A5 read 브로드캐스트 + B3 store `read` + B5 MessageBubble. 뱃지 비실시간(4-A) → B8.
- **플레이스홀더**: 없음. 모든 코드 스텝에 실제 코드.
- **타입 일관성**: `ChatMessage.id:number`, `ChatRoomSummary`, `createOrGetRoom`/`getRoomForParticipant`/`saveMessage`/`getMessagesAfter`/`getMyRooms`/`markRead` 시그니처가 서비스↔컨트롤러↔게이트웨이↔프론트에서 일치. `createChatRoomAction` 반환 `{roomId}|{error}`가 B4↔B7 일치. `mergeMessages` B2↔B3 일치.
- **범위 밖 제외 확인**: 과거 스크롤 페이지네이션 없음(FE-1), 재연결 튜닝·미전송 큐 없음(덩어리 3), 측정 스크립트 없음(덩어리 2).
