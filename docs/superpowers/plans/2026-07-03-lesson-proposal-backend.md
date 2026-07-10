# 레슨 제안 백엔드 API 3종 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 학생이 받은 레슨 제안을 조회하고, 코치가 모집중 신청을 둘러보며 제안을 보낼 수 있는 백엔드 API 3종을 만든다.

**Architecture:** 기존 `lesson-request` 모듈에 코치용 목록 조회를 추가하고 `getMyLessonRequest`에 제안 nested include를 붙인다. 제안 생성은 `lesson-proposal` 모듈을 신설(coach-profile 모듈 구조 복제)한다. role 접근 제어는 서비스 레벨에서 `user.role` 조회 후 체크(기존 coach-profile.service 패턴). 스키마 변경 없음 — `LessonProposal` 모델과 `@@unique([requestId, coachId])`는 이미 존재.

**Tech Stack:** NestJS 11, Prisma 7 (`generated/prisma`), Jest (prisma mock 방식)

---

## 참고 규칙

- 주석: 루트 CLAUDE.md 스타일 — 여러 단계 로직은 `// 1단계:` 번호 주석, 분기 위 경우 설명 한 줄, 나열 함수마다 정체 주석.
- 코드: ponytail(최소 구현). 새 Guard/추상화 안 만듦.
- Prisma 에러 catch: `import { Prisma } from '../../generated/prisma/client'` 후 `err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'`.
- enum import: `import type { Region } from '../../generated/prisma/enums'` (기존 패턴).

---

## File Structure

- Modify: `apps/api/src/lesson-request/lesson-request.service.ts` — `getMyLessonRequest` 수정 + `getOpenLessonRequests` 추가
- Modify: `apps/api/src/lesson-request/lesson-request.controller.ts` — `@Get()` 코치 목록 라우트 추가
- Modify: `apps/api/src/lesson-request/lesson-request.service.spec.ts` — 신규 케이스 추가
- Create: `apps/api/src/lesson-proposal/lesson-proposal.module.ts`
- Create: `apps/api/src/lesson-proposal/lesson-proposal.controller.ts`
- Create: `apps/api/src/lesson-proposal/lesson-proposal.service.ts`
- Create: `apps/api/src/lesson-proposal/dto/create-lesson-proposal.dto.ts`
- Create: `apps/api/src/lesson-proposal/lesson-proposal.service.spec.ts`
- Modify: `apps/api/src/app.module.ts` — `LessonProposalModule` 등록
- Modify: `docs/SPEC.md` — 응답 예시 `coach` → `coachProfile`

---

## Task 0: 설계 문서 커밋

**Files:**
- 이미 생성됨: `docs/superpowers/specs/2026-07-03-lesson-proposal-backend-design.md`

- [ ] **Step 1: 설계 문서 + 이 계획 커밋**

```bash
git add docs/superpowers/specs/2026-07-03-lesson-proposal-backend-design.md docs/superpowers/plans/2026-07-03-lesson-proposal-backend.md
git commit -m "docs: add lesson-proposal backend design and plan"
```

---

## Task 1: GET /lesson-requests/me — 제안 nested 조회 + 평탄화

**Files:**
- Modify: `apps/api/src/lesson-request/lesson-request.service.ts` (`getMyLessonRequest`)
- Test: `apps/api/src/lesson-request/lesson-request.service.spec.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`lesson-request.service.spec.ts`의 prisma mock에 `lessonRequest.findFirst`는 이미 있음. `describe('getMyLessonRequest')` 블록을 추가한다.

```ts
describe('getMyLessonRequest', () => {
  it('제안을 최신순으로 include하고 coachProfile로 평탄화해 반환한다', async () => {
    prisma.lessonRequest.findFirst.mockResolvedValue({
      id: 'req-1', studentId: 'uuid-1', region: 'SEOUL', goal: 'g', genre: 'POP', createdAt: new Date(),
      proposals: [
        { id: 'p-1', message: '안녕', createdAt: new Date(), coach: { coachProfile: { activityName: '김보컬', region: 'SEOUL' } } },
      ],
    });

    const result = await service.getMyLessonRequest('uuid-1');

    // include로 proposals(최신순) + coach.coachProfile 요청 확인
    expect(prisma.lessonRequest.findFirst).toHaveBeenCalledWith({
      where: { studentId: 'uuid-1' },
      include: {
        proposals: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, message: true, createdAt: true,
            coach: { select: { coachProfile: { select: { activityName: true, region: true } } } },
          },
        },
      },
    });
    // coach.coachProfile 한 겹을 벗겨 coachProfile 키로 평탄화
    expect(result!.proposals[0]).toEqual({
      id: 'p-1', message: '안녕', createdAt: expect.any(Date),
      coachProfile: { activityName: '김보컬', region: 'SEOUL' },
    });
  });

  it('신청이 없으면 null을 반환한다', async () => {
    prisma.lessonRequest.findFirst.mockResolvedValue(null);
    expect(await service.getMyLessonRequest('uuid-1')).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter=@mulink/api test -- lesson-request.service`
Expected: FAIL — 현재 `getMyLessonRequest`는 include 없이 findFirst만 호출하므로 `toHaveBeenCalledWith`/평탄화 assert가 깨짐.

- [ ] **Step 3: 구현**

`lesson-request.service.ts`의 `getMyLessonRequest`를 교체:

```ts
  // 내 레슨 신청 조회 (받은 제안 + 각 제안 코치 프로필까지 한 번에)
  async getMyLessonRequest(userId: string) {
    // 1단계: 내 신청 + 제안(최신순) + 각 제안 코치의 프로필을 한 방에 조회
    const request = await this.prisma.lessonRequest.findFirst({
      where: { studentId: userId },
      include: {
        proposals: {
          orderBy: { createdAt: 'desc' }, // 최신순 (기획)
          select: {
            id: true,
            message: true,
            createdAt: true,
            coach: {
              select: { coachProfile: { select: { activityName: true, region: true } } },
            },
          },
        },
      },
    });
    if (!request) return null;

    // 2단계: coach.coachProfile 한 겹을 벗겨 응답을 평탄화 (내부 테이블 구조 은닉)
    return {
      ...request,
      proposals: request.proposals.map((p) => ({
        id: p.id,
        message: p.message,
        createdAt: p.createdAt,
        coachProfile: p.coach.coachProfile, // { activityName, region }
      })),
    };
  }
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter=@mulink/api test -- lesson-request.service`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src/lesson-request/lesson-request.service.ts apps/api/src/lesson-request/lesson-request.service.spec.ts
git commit -m "feat(api): include proposals with coach profile in getMyLessonRequest"
```

---

## Task 2: GET /lesson-requests — 코치용 모집 목록 + isProposed

**Files:**
- Modify: `apps/api/src/lesson-request/lesson-request.service.ts` (`getOpenLessonRequests` 추가)
- Modify: `apps/api/src/lesson-request/lesson-request.controller.ts` (`@Get()` 추가)
- Test: `apps/api/src/lesson-request/lesson-request.service.spec.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

mock에 `lessonProposal` 추가 필요. spec 상단 prisma mock에 아래 줄 추가:

```ts
    lessonProposal: { findMany: jest.fn() },
```

그리고 describe 추가:

```ts
describe('getOpenLessonRequests', () => {
  it('학생이 호출하면 ForbiddenException을 던진다', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'uuid-1', role: 'STUDENT' });
    await expect(service.getOpenLessonRequests('uuid-1')).rejects.toThrow(ForbiddenException);
  });

  it('코치가 호출하면 각 신청에 isProposed를 붙여 반환한다', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'coach-1', role: 'COACH' });
    prisma.lessonRequest.findMany.mockResolvedValue([
      { id: 'req-1', region: 'SEOUL', goal: 'g1', genre: 'POP', createdAt: new Date() },
      { id: 'req-2', region: 'BUSAN', goal: 'g2', genre: 'ROCK', createdAt: new Date() },
    ]);
    // 코치가 이미 req-1에 제안함
    prisma.lessonProposal.findMany.mockResolvedValue([{ requestId: 'req-1' }]);

    const result = await service.getOpenLessonRequests('coach-1');

    expect(result[0].isProposed).toBe(true);
    expect(result[1].isProposed).toBe(false);
  });
});
```

`lessonRequest.findMany`도 mock에 추가:

```ts
    lessonRequest: {
      findFirst: jest.fn(),
      findMany: jest.fn(),   // 추가
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter=@mulink/api test -- lesson-request.service`
Expected: FAIL — `getOpenLessonRequests`가 아직 없음.

- [ ] **Step 3: 구현**

`lesson-request.service.ts`에 메서드 추가 (기존 메서드들 사이, `getMyLessonRequest` 아래 등):

```ts
  // 모집중 레슨 신청 목록 조회 (코치) — 각 신청에 내가 이미 제안했는지(isProposed) 표시
  async getOpenLessonRequests(userId: string) {
    // 1단계: 코치 자격 확인 — 학생은 이 화면을 쓰지 않음
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== 'COACH') {
      throw new ForbiddenException('코치만 접근할 수 있습니다.');
    }

    // 2단계: 모집중 신청 전체 조회 (최신순)
    const requests = await this.prisma.lessonRequest.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // 3단계: 이 코치가 이미 제안한 신청 id 집합
    const myProposals = await this.prisma.lessonProposal.findMany({
      where: { coachId: userId },
      select: { requestId: true },
    });
    const proposedIds = new Set(myProposals.map((p) => p.requestId));

    // 4단계: 각 신청에 isProposed 플래그를 붙여 반환
    return requests.map((r) => ({ ...r, isProposed: proposedIds.has(r.id) }));
  }
```

`ForbiddenException`은 이미 상단 import에 존재(파일 확인). 없으면 `@nestjs/common` import에 추가.

- [ ] **Step 4: 컨트롤러 라우트 추가**

`lesson-request.controller.ts` — `@Get('me')` 위 또는 아래에 추가:

```ts
  // 모집중 레슨 신청 목록 조회 GET 요청 (코치)
  @Get()
  async getOpenLessonRequests(@Req() req: AuthedRequest) {
    return this.lessonRequestService.getOpenLessonRequests(req.user.id);
  }
```

> 주의: `@Get()`(루트)와 `@Get('me')`는 경로가 달라 충돌 없음. NestJS는 더 구체적인 `me`를 우선 매칭.

- [ ] **Step 5: 테스트 통과 확인**

Run: `pnpm --filter=@mulink/api test -- lesson-request.service`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add apps/api/src/lesson-request/
git commit -m "feat(api): add coach open lesson-requests list with isProposed flag"
```

---

## Task 3: lesson-proposal 모듈 — POST 제안 생성

**Files:**
- Create: `apps/api/src/lesson-proposal/dto/create-lesson-proposal.dto.ts`
- Create: `apps/api/src/lesson-proposal/lesson-proposal.service.ts`
- Create: `apps/api/src/lesson-proposal/lesson-proposal.controller.ts`
- Create: `apps/api/src/lesson-proposal/lesson-proposal.module.ts`
- Create: `apps/api/src/lesson-proposal/lesson-proposal.service.spec.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: DTO 작성**

`dto/create-lesson-proposal.dto.ts`:

```ts
// POST /lesson-requests/:id/lesson-proposals 요청 body. 제안 한마디만 받는다.
export interface CreateLessonProposalDto {
  message: string;
}
```

- [ ] **Step 2: 실패하는 서비스 테스트 작성**

`lesson-proposal.service.spec.ts`:

```ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { LessonProposalService } from './lesson-proposal.service';

describe('LessonProposalService', () => {
  const prisma = {
    user: { findUnique: jest.fn() },
    lessonRequest: { findUnique: jest.fn() },
    lessonProposal: { create: jest.fn() },
  };
  const service = new LessonProposalService(prisma as any);

  beforeEach(() => jest.clearAllMocks());

  it('빈 message면 BadRequestException을 던진다', async () => {
    await expect(
      service.createProposal('coach-1', 'req-1', { message: '  ' }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.lessonProposal.create).not.toHaveBeenCalled();
  });

  it('학생이 제안하면 ForbiddenException을 던진다', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'stu-1', role: 'STUDENT' });
    await expect(
      service.createProposal('stu-1', 'req-1', { message: '안녕' }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.lessonProposal.create).not.toHaveBeenCalled();
  });

  it('삭제된(없는) 신청에 제안하면 NotFoundException을 던진다', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'coach-1', role: 'COACH' });
    prisma.lessonRequest.findUnique.mockResolvedValue(null);
    await expect(
      service.createProposal('coach-1', 'gone', { message: '안녕' }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.lessonProposal.create).not.toHaveBeenCalled();
  });

  it('이미 제안한 신청(P2002)이면 ConflictException을 던진다', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'coach-1', role: 'COACH' });
    prisma.lessonRequest.findUnique.mockResolvedValue({ id: 'req-1' });
    prisma.lessonProposal.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' }),
    );
    await expect(
      service.createProposal('coach-1', 'req-1', { message: '안녕' }),
    ).rejects.toThrow(ConflictException);
  });

  it('정상 제안 시 message를 trim해 생성한다', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'coach-1', role: 'COACH' });
    prisma.lessonRequest.findUnique.mockResolvedValue({ id: 'req-1' });
    prisma.lessonProposal.create.mockResolvedValue({ id: 'p-1' });

    const result = await service.createProposal('coach-1', 'req-1', { message: '  안녕  ' });

    expect(prisma.lessonProposal.create).toHaveBeenCalledWith({
      data: { requestId: 'req-1', coachId: 'coach-1', message: '안녕' },
    });
    expect(result.id).toBe('p-1');
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `pnpm --filter=@mulink/api test -- lesson-proposal.service`
Expected: FAIL — 서비스 파일 없음.

- [ ] **Step 4: 서비스 구현**

`lesson-proposal.service.ts`:

```ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import type { CreateLessonProposalDto } from './dto/create-lesson-proposal.dto';

@Injectable()
export class LessonProposalService {
  constructor(private readonly prisma: PrismaService) {}

  // 레슨 제안 생성 (1신청 1제안)
  async createProposal(
    userId: string,
    requestId: string,
    dto: CreateLessonProposalDto,
  ) {
    // 1단계: 한마디 검증 — 공백만이면 거부
    const message = dto.message?.trim();
    if (!message) {
      throw new BadRequestException('제안 한마디를 입력해주세요.');
    }

    // 2단계: 코치 자격 확인 — 학생은 제안할 수 없음
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== 'COACH') {
      throw new ForbiddenException('코치만 제안할 수 있습니다.');
    }

    // 3단계: 대상 신청 존재 확인 — 그새 삭제됐으면 막는다 (기획 엣지케이스)
    const request = await this.prisma.lessonRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) {
      throw new NotFoundException('레슨 신청을 찾을 수 없습니다.');
    }

    // 4단계: 제안 생성. 중복(@@unique 위반)은 DB가 막고 P2002로 던진다 (동시요청 방어)
    try {
      return await this.prisma.lessonProposal.create({
        data: { requestId, coachId: userId, message },
      });
    } catch (err) {
      // 이미 이 신청에 제안한 코치
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('이미 제안한 레슨 신청입니다.');
      }
      throw err;
    }
  }
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `pnpm --filter=@mulink/api test -- lesson-proposal.service`
Expected: PASS

- [ ] **Step 6: 컨트롤러 작성**

`lesson-proposal.controller.ts` (coach-profile.controller 구조 복제):

```ts
import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { LessonProposalService } from './lesson-proposal.service';
import type { CreateLessonProposalDto } from './dto/create-lesson-proposal.dto';

type AuthedRequest = { user: SupabaseUser };

@Controller('lesson-requests/:id/lesson-proposals')
@UseGuards(SupabaseAuthGuard)
export class LessonProposalController {
  constructor(private readonly lessonProposalService: LessonProposalService) {}

  // 레슨 제안 생성 POST 요청 (body로 coachId를 받지 않음 — 위조 방지)
  @Post()
  async createProposal(
    @Req() req: AuthedRequest,
    @Param('id') requestId: string,
    @Body() dto: CreateLessonProposalDto,
  ) {
    return this.lessonProposalService.createProposal(req.user.id, requestId, dto);
  }
}
```

- [ ] **Step 7: 모듈 작성**

`lesson-proposal.module.ts` (coach-profile.module 구조 복제):

```ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LessonProposalController } from './lesson-proposal.controller';
import { LessonProposalService } from './lesson-proposal.service';

@Module({
  imports: [AuthModule],
  controllers: [LessonProposalController],
  providers: [LessonProposalService],
})
export class LessonProposalModule {}
```

- [ ] **Step 8: app.module.ts에 등록**

`app.module.ts` — import 추가 + imports 배열에 `LessonProposalModule` 추가:

```ts
import { LessonProposalModule } from './lesson-proposal/lesson-proposal.module';
```
imports 배열 `LessonRequestModule` 아래에 `LessonProposalModule,` 추가.

- [ ] **Step 9: 타입체크 + 전체 테스트**

Run: `pnpm --filter=@mulink/api test -- lesson-proposal && pnpm turbo check-types --filter=@mulink/api`
Expected: PASS

- [ ] **Step 10: 커밋**

```bash
git add apps/api/src/lesson-proposal/ apps/api/src/app.module.ts
git commit -m "feat(api): add lesson-proposal module with create endpoint"
```

---

## Task 4: SPEC.md 응답 예시 수정

**Files:**
- Modify: `docs/SPEC.md`

- [ ] **Step 1: 예시 JSON 키 수정**

`docs/SPEC.md` 4장 `GET /lesson-requests/me` 응답 예시에서 `"coach": { "activityName": "...", "region": "SEOUL" }` 를 `"coachProfile": { "activityName": "...", "region": "SEOUL" }` 로 바꾸고, 옆 주석 `// CoachProfile nested` 유지.

- [ ] **Step 2: 커밋**

```bash
git add docs/SPEC.md
git commit -m "docs: rename proposal coach key to coachProfile in SPEC"
```

---

## Self-Review 결과

- **Spec coverage:** 설계 3개 API 전부 Task 1~3에 매핑. SPEC 수정 Task 4. ✅
- **Type consistency:** `coachProfile` 키 이름 Task1(구현)·Task1(테스트)·Task4(문서) 일치. `isProposed` Task2 일치. `createProposal(userId, requestId, dto)` 시그니처 Task3 controller/service/test 일치. ✅
- **Placeholder:** 없음. 모든 step에 실제 코드. ✅
- **범위 밖 명시:** `GET /lesson-proposals/me`, `DELETE /lesson-proposals/:id`, 프론트 연동은 다음 작업. ✅
