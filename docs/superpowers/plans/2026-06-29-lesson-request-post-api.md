# 레슨 신청 POST API 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 학생이 레슨을 신청할 수 있는 `POST /lesson-requests` 엔드포인트를 구현한다.

**Architecture:** Coach 모듈과 동일한 패턴(module/controller/service/dto)을 따른다. SupabaseAuthGuard로 인증하고, 중복 신청은 ConflictException으로 막는다. Genre enum을 스키마에 추가하고 LessonRequest.genre 타입을 변경한다.

**Tech Stack:** NestJS 11, Prisma 7, Supabase Auth, PostgreSQL

---

## 파일 구조

| 작업 | 파일 |
|------|------|
| 생성 | `apps/api/prisma/schema.prisma` (Genre enum 추가, LessonRequest.genre 타입 변경) |
| 생성 | `apps/api/src/lesson/dto/create-lesson-request.dto.ts` |
| 생성 | `apps/api/src/lesson/lesson.service.ts` |
| 생성 | `apps/api/src/lesson/lesson.service.spec.ts` |
| 생성 | `apps/api/src/lesson/lesson.controller.ts` |
| 생성 | `apps/api/src/lesson/lesson.module.ts` |
| 수정 | `apps/api/src/app.module.ts` (LessonModule 등록) |

---

## 참고: Coach 모듈 패턴 (그대로 따를 것)

- `apps/api/src/coach/coach.service.ts` — 비즈니스 로직 구조
- `apps/api/src/coach/coach.controller.ts` — `@UseGuards(SupabaseAuthGuard)`, `req.user.id` 추출
- `apps/api/src/coach/coach.module.ts` — `AuthModule` import
- `apps/api/src/coach/coach.service.spec.ts` — 테스트 패턴 (PrismaService 목 방식)
- `apps/api/src/coach/dto/register-coach.dto.ts` — DTO interface 구조

---

## Task 1: Genre enum 추가 및 스키마 변경

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Genre enum 추가 및 LessonRequest.genre 타입 변경**

`schema.prisma`의 `VocalTier` enum 다음에 아래 내용을 추가하고, `LessonRequest.genre`를 `String` → `Genre`로 변경한다.

```prisma
// 선호 장르
enum Genre {
  POP
  BALLAD
  ROCK
  RNB
  JAZZ
  HIPHOP
  TROT
}
```

`LessonRequest` 모델에서:
```prisma
// 변경 전
genre        String // 선호 장르

// 변경 후
genre        Genre  // 선호 장르
```

- [ ] **Step 2: 마이그레이션 실행**

```sh
pnpm --filter=@mulink/api exec prisma migrate dev --name add_genre_enum
```

예상 출력: `Your database is now in sync with your schema.`

- [ ] **Step 3: Prisma 클라이언트 재생성**

```sh
pnpm --filter=@mulink/api exec prisma generate
```

예상 출력: `Generated Prisma Client (7.x.x) to ./generated/prisma`

- [ ] **Step 4: 커밋**

```sh
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat(api): add Genre enum and update LessonRequest.genre type"
```

---

## Task 2: DTO 작성

**Files:**
- Create: `apps/api/src/lesson/dto/create-lesson-request.dto.ts`

- [ ] **Step 1: DTO 파일 생성**

```typescript
import type { Region, Genre } from '../../../generated/prisma/enums';

export interface CreateLessonRequestDto {
  region: Region;
  goal: string;
  genre: Genre;
  voiceAudioUrl: string;
}
```

- [ ] **Step 2: 커밋**

```sh
git add apps/api/src/lesson/dto/create-lesson-request.dto.ts
git commit -m "feat(api): add CreateLessonRequestDto"
```

---

## Task 3: LessonService 구현 (TDD)

**Files:**
- Create: `apps/api/src/lesson/lesson.service.ts`
- Create: `apps/api/src/lesson/lesson.service.spec.ts`

- [ ] **Step 1: 실패하는 테스트 먼저 작성**

`apps/api/src/lesson/lesson.service.spec.ts`:

```typescript
import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { LessonService } from './lesson.service';

describe('LessonService', () => {
  const prisma = {
    user: { findUnique: jest.fn() },
    lessonRequest: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };
  const service = new LessonService(prisma as any);

  const validDto = {
    region: 'SEOUL' as const,
    goal: '음정 교정',
    genre: 'POP' as const,
    voiceAudioUrl: 'https://example.com/audio.mp3',
  };

  beforeEach(() => jest.clearAllMocks());

  it('정상 신청 시 LessonRequest를 생성하고 반환한다', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'uuid-1', role: 'STUDENT' });
    prisma.lessonRequest.findFirst.mockResolvedValue(null);
    prisma.lessonRequest.create.mockResolvedValue({
      id: 'req-1',
      studentId: 'uuid-1',
      region: 'SEOUL',
      goal: '음정 교정',
      genre: 'POP',
      voiceAudioUrl: 'https://example.com/audio.mp3',
      createdAt: new Date(),
    });

    const result = await service.createLessonRequest('uuid-1', validDto);

    expect(prisma.lessonRequest.create).toHaveBeenCalledWith({
      data: {
        studentId: 'uuid-1',
        region: 'SEOUL',
        goal: '음정 교정',
        genre: 'POP',
        voiceAudioUrl: 'https://example.com/audio.mp3',
      },
    });
    expect(result.id).toBe('req-1');
  });

  it('User가 없으면 NotFoundException을 던진다', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.createLessonRequest('uuid-1', validDto),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.lessonRequest.create).not.toHaveBeenCalled();
  });

  it('이미 신청 내역이 있으면 ConflictException을 던진다', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'uuid-1', role: 'STUDENT' });
    prisma.lessonRequest.findFirst.mockResolvedValue({ id: 'existing-req' });

    await expect(
      service.createLessonRequest('uuid-1', validDto),
    ).rejects.toThrow(ConflictException);
    expect(prisma.lessonRequest.create).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```sh
pnpm --filter=@mulink/api test -- lesson.service
```

예상: `Cannot find module './lesson.service'` 또는 유사한 실패

- [ ] **Step 3: LessonService 구현**

`apps/api/src/lesson/lesson.service.ts`:

```typescript
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateLessonRequestDto } from './dto/create-lesson-request.dto';

@Injectable()
export class LessonService {
  constructor(private readonly prisma: PrismaService) {}

  async createLessonRequest(userId: string, dto: CreateLessonRequestDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('유저를 찾을 수 없습니다.');
    }

    const existing = await this.prisma.lessonRequest.findFirst({
      where: { studentId: userId },
    });
    if (existing) {
      throw new ConflictException('이미 레슨 신청 내역이 있습니다.');
    }

    return this.prisma.lessonRequest.create({
      data: {
        studentId: userId,
        region: dto.region,
        goal: dto.goal,
        genre: dto.genre,
        voiceAudioUrl: dto.voiceAudioUrl,
      },
    });
  }
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```sh
pnpm --filter=@mulink/api test -- lesson.service
```

예상: `3 passed`

- [ ] **Step 5: 커밋**

```sh
git add apps/api/src/lesson/lesson.service.ts apps/api/src/lesson/lesson.service.spec.ts
git commit -m "feat(api): implement LessonService with TDD"
```

---

## Task 4: LessonController 구현

**Files:**
- Create: `apps/api/src/lesson/lesson.controller.ts`

- [ ] **Step 1: Controller 파일 생성**

`apps/api/src/lesson/lesson.controller.ts`:

```typescript
import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { LessonService } from './lesson.service';
import type { CreateLessonRequestDto } from './dto/create-lesson-request.dto';

type AuthedRequest = { user: SupabaseUser };

@Controller('lesson-requests')
@UseGuards(SupabaseAuthGuard)
export class LessonController {
  constructor(private readonly lessonService: LessonService) {}

  @Post()
  async createLessonRequest(
    @Req() req: AuthedRequest,
    @Body() dto: CreateLessonRequestDto,
  ) {
    return this.lessonService.createLessonRequest(req.user.id, dto);
  }
}
```

- [ ] **Step 2: 타입 체크**

```sh
pnpm check-types
```

예상: 오류 없음

- [ ] **Step 3: 커밋**

```sh
git add apps/api/src/lesson/lesson.controller.ts
git commit -m "feat(api): add LessonController"
```

---

## Task 5: LessonModule 등록 및 AppModule 연결

**Files:**
- Create: `apps/api/src/lesson/lesson.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: LessonModule 생성**

`apps/api/src/lesson/lesson.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LessonController } from './lesson.controller';
import { LessonService } from './lesson.service';

@Module({
  imports: [AuthModule],
  controllers: [LessonController],
  providers: [LessonService],
})
export class LessonModule {}
```

- [ ] **Step 2: AppModule에 LessonModule 등록**

`apps/api/src/app.module.ts`의 `imports` 배열에 `LessonModule` 추가:

```typescript
import { LessonModule } from './lesson/lesson.module';

@Module({
  imports: [PrismaModule, AuthModule, CoachModule, LessonModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

- [ ] **Step 3: 타입 체크**

```sh
pnpm check-types
```

예상: 오류 없음

- [ ] **Step 4: 전체 테스트 실행**

```sh
pnpm --filter=@mulink/api test
```

예상: 모든 테스트 통과

- [ ] **Step 5: 커밋**

```sh
git add apps/api/src/lesson/lesson.module.ts apps/api/src/app.module.ts
git commit -m "feat(api): register LessonModule in AppModule"
```

---

## 검증

```sh
# 서버 실행
pnpm turbo dev --filter=@mulink/api

# 정상 신청 (201 반환 확인)
curl -X POST http://localhost:3000/lesson-requests \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"region":"SEOUL","goal":"음정 교정","genre":"POP","voiceAudioUrl":"https://example.com/audio.mp3"}'

# 중복 신청 시 409 ConflictException 확인
# (같은 토큰으로 한 번 더 요청)

# 인증 없이 요청 시 401 확인
curl -X POST http://localhost:3000/lesson-requests \
  -H "Content-Type: application/json" \
  -d '{"region":"SEOUL","goal":"음정 교정","genre":"POP","voiceAudioUrl":"https://example.com/audio.mp3"}'
```
