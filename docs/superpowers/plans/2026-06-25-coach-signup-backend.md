# 코치 회원가입 백엔드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로그인된 STUDENT가 활동명·지역을 제출하면 Prisma 트랜잭션으로 COACH 승격 + CoachProfile을 생성하는 `POST /coaches` API를 추가한다.

**Architecture:** 기존 카카오 auth 코드는 수정하지 않고 신규 `CoachModule`(controller/service/dto)을 추가한다. `SupabaseAuthGuard`로 로그인을 강제하고, 자격 확인(STUDENT 여부)은 트랜잭션 밖에서, 쓰기(User.role 변경 + CoachProfile 생성)는 `prisma.$transaction`으로 묶어 데이터 일관성을 보장한다.

**Tech Stack:** NestJS 11, Prisma 7(생성 경로 `apps/api/generated/prisma`), Jest, PostgreSQL.

**참고 스펙:** `docs/superpowers/specs/2026-06-25-coach-signup-backend-design.md`

---

## File Structure

- `apps/api/prisma/schema.prisma` — `Region` enum + `CoachProfile` 모델 + `User.coachProfile` 관계 추가 (수정)
- `apps/api/src/coach/dto/register-coach.dto.ts` — 요청 body 타입 (생성)
- `apps/api/src/coach/coach.service.ts` — `registerCoach` 로직 (생성)
- `apps/api/src/coach/coach.service.spec.ts` — 단위 테스트 (생성)
- `apps/api/src/coach/coach.controller.ts` — `POST /coaches` (생성)
- `apps/api/src/coach/coach.module.ts` — 모듈 등록 (생성)
- `apps/api/src/auth/auth.module.ts` — `SupabaseAuthGuard`/`SupabaseService` export (수정)
- `apps/api/src/app.module.ts` — `CoachModule` import 추가 (수정)

**중요 사전 지식:**
- `PrismaModule`은 `@Global()`이라 CoachModule이 import 없이 `PrismaService` 주입 가능.
- `SupabaseAuthGuard`는 `SupabaseService`에 의존하며 둘 다 `AuthModule` 소속 → CoachModule이 가드를 쓰려면 AuthModule이 둘을 export하고 CoachModule이 AuthModule을 import해야 함 (Task 6에서 처리).
- role 비교는 기존 코드 관행대로 string literal(`'STUDENT'`/`'COACH'`/`'ADMIN'`)을 쓴다. enum 객체 import 불필요.

---

## Task 1: Prisma 스키마에 Region enum + CoachProfile 추가

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: schema.prisma 수정**

`VocalTier` enum 아래(기존 enum들 근처)에 `Region` enum 추가:

```prisma
// 코치 활동 지역
enum Region {
  SEOUL    // 서울
  GYEONGGI // 경기
  INCHEON  // 인천
}
```

`User` 모델에 관계 필드 한 줄 추가 (기존 `lessonRequests` 줄 아래):

```prisma
  coachProfile   CoachProfile?  // 코치일 때만 존재 (가상 — DB 컬럼 안 생김)
```

`LessonRequest` 모델 아래에 새 모델 추가:

```prisma
// 코치 프로필 테이블 (User와 1:1, COACH일 때만 존재)
model CoachProfile {
  id           String   @id @default(cuid())
  userId       String   @unique @db.Uuid // FK + 1:1 보장 — User.id(UUID)와 타입 일치
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  activityName String // 활동명
  region       Region // 활동 지역
  createdAt    DateTime @default(now())
}
```

- [ ] **Step 2: Prisma 클라이언트 재생성**

Run: `pnpm --filter=@mulink/api exec prisma generate`
Expected: 성공 메시지. `apps/api/generated/prisma/enums.ts`에 `Region` export가 추가됨.

- [ ] **Step 3: 타입체크로 스키마 반영 확인**

Run: `pnpm --filter=@mulink/api exec prisma validate`
Expected: "The schema at ... is valid"

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat: CoachProfile 모델 및 Region enum 추가

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: RegisterCoachDto 정의

**Files:**
- Create: `apps/api/src/coach/dto/register-coach.dto.ts`

- [ ] **Step 1: DTO 파일 작성**

```typescript
import type { Region } from '../../../generated/prisma/enums';

// POST /coaches 요청 body. 활동명·지역만 받는다 (카카오ID/닉네임은 이미 User에 있음).
export interface RegisterCoachDto {
  activityName: string;
  region: Region;
}
```

- [ ] **Step 2: 타입체크**

Run: `pnpm --filter=@mulink/api check-types`
Expected: 에러 없음 (DTO만으로는 사용처가 없어 통과).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/coach/dto/register-coach.dto.ts
git commit -m "feat: RegisterCoachDto 추가

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: CoachService 테스트 작성 (TDD - 실패하는 테스트)

**Files:**
- Test: `apps/api/src/coach/coach.service.spec.ts`

기존 `auth.service.spec.ts` 스타일대로 prisma를 목킹한다. `$transaction`은 전달된 콜백을 `prismaTransaction` 목으로 실행시켜 update/create 호출을 검증한다.

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CoachService } from './coach.service';

describe('CoachService', () => {
  // 트랜잭션 콜백 안에서 쓰는 목 (update + create)
  const prismaTransaction = {
    user: { update: jest.fn() },
    coachProfile: { create: jest.fn() },
  };
  const prisma = {
    user: { findUnique: jest.fn() },
    // $transaction(콜백) 형태: 콜백에 prismaTransaction 목을 넘겨 실행
    $transaction: jest.fn((callback: any) => callback(prismaTransaction)),
  };
  const service = new CoachService(prisma as any);

  const validDto = { activityName: '보컬코치홍', region: 'SEOUL' as const };

  beforeEach(() => jest.clearAllMocks());

  it('STUDENT가 등록하면 트랜잭션으로 role 승격 + CoachProfile을 생성한다', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'uuid-1', role: 'STUDENT' });
    prismaTransaction.coachProfile.create.mockResolvedValue({
      id: 'coach-1',
      userId: 'uuid-1',
      activityName: '보컬코치홍',
      region: 'SEOUL',
    });

    const result = await service.registerCoach('uuid-1', validDto);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaTransaction.user.update).toHaveBeenCalledWith({
      where: { id: 'uuid-1' },
      data: { role: 'COACH' },
    });
    expect(prismaTransaction.coachProfile.create).toHaveBeenCalledWith({
      data: { userId: 'uuid-1', activityName: '보컬코치홍', region: 'SEOUL' },
    });
    expect(result).toEqual({
      id: 'coach-1',
      userId: 'uuid-1',
      activityName: '보컬코치홍',
      region: 'SEOUL',
    });
  });

  it('활동명이 빈 문자열이면 BadRequestException, 트랜잭션을 호출하지 않는다', async () => {
    await expect(
      service.registerCoach('uuid-1', { activityName: '  ', region: 'SEOUL' }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('지역이 enum 값이 아니면 BadRequestException, 트랜잭션을 호출하지 않는다', async () => {
    await expect(
      service.registerCoach('uuid-1', {
        activityName: '홍',
        region: 'BUSAN' as any,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('이미 COACH면 ConflictException, 트랜잭션을 호출하지 않는다', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'uuid-1', role: 'COACH' });
    await expect(service.registerCoach('uuid-1', validDto)).rejects.toThrow(
      ConflictException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('ADMIN이면 ConflictException, 트랜잭션을 호출하지 않는다', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'uuid-1', role: 'ADMIN' });
    await expect(service.registerCoach('uuid-1', validDto)).rejects.toThrow(
      ConflictException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('User가 없으면 NotFoundException, 트랜잭션을 호출하지 않는다', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.registerCoach('uuid-1', validDto)).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `pnpm --filter=@mulink/api test -- coach.service`
Expected: FAIL — "Cannot find module './coach.service'" (아직 서비스 미구현).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/coach/coach.service.spec.ts
git commit -m "test: CoachService registerCoach 테스트 추가

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: CoachService 구현 (테스트 통과)

**Files:**
- Create: `apps/api/src/coach/coach.service.ts`

- [ ] **Step 1: 서비스 구현**

```typescript
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Region } from '../../generated/prisma/enums';
import type { RegisterCoachDto } from './dto/register-coach.dto';

@Injectable()
export class CoachService {
  constructor(private readonly prisma: PrismaService) {}

  // 로그인된 STUDENT를 COACH로 승격하고 CoachProfile을 생성한다.
  async registerCoach(userId: string, dto: RegisterCoachDto) {
    // 1. 입력 검증 (수동) — 트랜잭션 전에 빠르게 거른다.
    if (!dto.activityName?.trim()) {
      throw new BadRequestException('활동명을 입력해주세요.');
    }
    if (!Object.values(Region).includes(dto.region)) {
      throw new BadRequestException('지역은 서울/경기/인천 중 선택해주세요.');
    }

    // 2. 자격 확인 — 트랜잭션 밖에서 조회·거부.
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('유저를 찾을 수 없습니다.');
    if (user.role === 'COACH') {
      throw new ConflictException('이미 코치로 등록된 계정입니다.');
    }
    if (user.role === 'ADMIN') {
      throw new ConflictException('코치로 등록할 수 없는 계정입니다.');
    }

    // 3. 쓰기 — role 승격 + 프로필 생성을 한 트랜잭션으로 묶는다.
    return this.prisma.$transaction(async (prismaTransaction) => {
      await prismaTransaction.user.update({
        where: { id: userId },
        data: { role: 'COACH' },
      });
      return prismaTransaction.coachProfile.create({
        data: {
          userId,
          activityName: dto.activityName.trim(),
          region: dto.region,
        },
      });
    });
  }
}
```

- [ ] **Step 2: 테스트 실행 → 통과 확인**

Run: `pnpm --filter=@mulink/api test -- coach.service`
Expected: PASS — 6개 케이스 모두 통과.

> 주의: Step 1 테스트는 `activityName: '보컬코치홍'`(공백 없음)을 보내고 create 인자도 `'보컬코치홍'`을 기대한다. 구현이 `.trim()`을 적용해도 공백 없는 값은 그대로라 일치한다.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/coach/coach.service.ts
git commit -m "feat: CoachService registerCoach 구현

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: CoachController 구현

**Files:**
- Create: `apps/api/src/coach/coach.controller.ts`

기존 `auth.controller.ts` 패턴(가드 + `@Req()`에서 `req.user` 사용)을 그대로 따른다.

- [ ] **Step 1: 컨트롤러 작성**

```typescript
import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { CoachService } from './coach.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import type { RegisterCoachDto } from './dto/register-coach.dto';

type AuthedRequest = { user: SupabaseUser };

@Controller('coaches')
@UseGuards(SupabaseAuthGuard)
export class CoachController {
  constructor(private readonly coachService: CoachService) {}

  // 토큰 주인을 코치로 등록한다 (body로 userId를 받지 않음 — 위조 방지).
  @Post()
  async registerCoach(
    @Req() req: AuthedRequest,
    @Body() dto: RegisterCoachDto,
  ) {
    return this.coachService.registerCoach(req.user.id, dto);
  }
}
```

- [ ] **Step 2: 타입체크**

Run: `pnpm --filter=@mulink/api check-types`
Expected: 에러 없음.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/coach/coach.controller.ts
git commit -m "feat: CoachController POST /coaches 추가

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: 모듈 등록 (AuthModule export + CoachModule + AppModule)

**Files:**
- Modify: `apps/api/src/auth/auth.module.ts`
- Create: `apps/api/src/coach/coach.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: AuthModule이 가드/Supabase 서비스를 export하도록 수정**

`apps/api/src/auth/auth.module.ts`의 `@Module({...})`에 `exports` 추가 (providers는 그대로):

```typescript
@Module({
  controllers: [AuthController, KakaoAuthController, SessionController],
  providers: [
    AuthService,
    SupabaseService,
    SupabaseAuthGuard,
    KakaoOauthService,
    SupabaseAdminService,
    SessionCodeService,
  ],
  exports: [SupabaseAuthGuard, SupabaseService],
})
export class AuthModule {}
```

- [ ] **Step 2: CoachModule 작성**

`apps/api/src/coach/coach.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CoachController } from './coach.controller';
import { CoachService } from './coach.service';

// 코치 관련 기능 묶음. SupabaseAuthGuard를 쓰기 위해 AuthModule을 import한다.
// (PrismaService는 PrismaModule이 @Global이라 import 불필요)
@Module({
  imports: [AuthModule],
  controllers: [CoachController],
  providers: [CoachService],
})
export class CoachModule {}
```

- [ ] **Step 3: AppModule에 CoachModule 등록**

`apps/api/src/app.module.ts`의 `imports`에 `CoachModule` 추가:

```typescript
import { CoachModule } from './coach/coach.module';
// ...
@Module({
  imports: [PrismaModule, AuthModule, CoachModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

- [ ] **Step 4: 전체 테스트 + 타입체크 + 빌드 확인**

Run: `pnpm --filter=@mulink/api test`
Expected: 기존 테스트 + coach 테스트 전부 PASS.

Run: `pnpm --filter=@mulink/api check-types`
Expected: 에러 없음.

Run: `pnpm --filter=@mulink/api build`
Expected: 성공 (Nest DI 구성 오류 없이 빌드됨).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/auth/auth.module.ts apps/api/src/coach/coach.module.ts apps/api/src/app.module.ts
git commit -m "feat: CoachModule 등록 및 AuthModule 가드 export

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## 최종 검증 (전체 완료 후)

- [ ] `pnpm --filter=@mulink/api test` — 전체 그린
- [ ] `pnpm --filter=@mulink/api check-types` — 통과
- [ ] `pnpm --filter=@mulink/api build` — 성공
- [ ] (선택, DB 연결 시) dev 서버 띄워 유효 토큰으로 `POST /coaches` `{activityName, region:"SEOUL"}` → 201 + role=COACH 확인, 재호출 시 409 확인.

> 참고: `CoachProfile` 테이블을 실제 DB에 반영하려면 마이그레이션(`prisma migrate dev`)이 별도로 필요하다. 이 플랜은 스키마 정의 + 코드까지 다루며, 마이그레이션 실행은 DB 환경에 따라 사용자가 결정한다.
