# 카카오 로그인(Supabase Auth) 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Supabase Auth 카카오 OAuth로 로그인하고, NestJS가 JWT를 검증해 User를 생성/조회하는 인증 흐름을 최소 UI로 end-to-end 동작시킨다.

**Architecture:** 인증/토큰은 Supabase Auth, 인가/데이터는 NestJS+Prisma. 프론트(Next.js)는 DB에 직접 안 붙고 NestJS API만 경유한다. 첫 로그인 시 Next 콜백이 NestJS `POST /auth/sync`를 호출해 `public.User`(id=auth uid)를 만든다.

**Tech Stack:** Next.js 16(App Router, proxy.ts) + @supabase/ssr / NestJS 11 + Prisma 7 + @supabase/supabase-js / 테스트: web=vitest, api=jest

> 스펙: `docs/superpowers/specs/2026-06-17-kakao-supabase-auth-design.md`
> 명령어 참고: 테스트는 `pnpm --filter=@mulink/web test`(=`vitest run`), `pnpm --filter=@mulink/api test`(=`jest`). 단일 파일은 각 Task에 명시.
> Vercel best practices 적용 포인트는 각 web Task의 *적용* 항목 참고.

---

## File Structure

**apps/api (백엔드)**
- `src/auth/kakao-profile.ts` — Supabase User에서 `kakaoId`/`nickname` 추출하는 순수 함수
- `src/auth/supabase.service.ts` — supabase-js 클라이언트 보관, `getUser(token)` 래핑
- `src/auth/supabase-auth.guard.ts` — Bearer JWT 검증 Guard
- `src/auth/auth.controller.ts` — `POST /auth/sync`, `GET /auth/me`
- `src/auth/auth.module.ts` — 위 3개 등록
- `src/app.module.ts` (수정) — AuthModule import
- `src/main.ts` (수정) — CORS

**apps/web (프론트)**
- `src/shared/lib/supabase/client.ts` — 브라우저 클라이언트
- `src/shared/lib/supabase/server.ts` — 서버 클라이언트(cookies)
- `src/shared/lib/supabase/proxy-session.ts` — proxy용 세션 갱신
- `src/proxy.ts` — Next 16 proxy(구 middleware)
- `src/app/actions/auth.ts` — 로그아웃 server action
- `src/shared/ui/home-auth.tsx` — 로그인/비로그인 분기 표시(프레젠테이션)
- `src/app/login/page.tsx` — 로그인 페이지(클라이언트)
- `src/app/auth/callback/route.ts` — OAuth 콜백 → sync → 홈
- `src/app/page.tsx` (수정) — 세션 확인 후 HomeAuth 렌더

---

## Task 0: 패키지 설치 + RLS 활성화 (setup)

**Files:** `apps/web/package.json`, `apps/api/package.json`, DB(Supabase)

> ⚠️ CLAUDE.md 규칙: 설치 전 사용자에게 확인받는다.

- [ ] **Step 1: web 패키지 설치**

Run: `pnpm --filter=@mulink/web add @supabase/supabase-js @supabase/ssr`
Expected: package.json dependencies에 두 패키지 추가, lockfile 갱신

- [ ] **Step 2: api 패키지 설치**

Run: `pnpm --filter=@mulink/api add @supabase/supabase-js`
Expected: 설치 성공

- [ ] **Step 3: RLS 활성화 (Supabase MCP `execute_sql` 또는 psql DIRECT_URL)**

```sql
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LessonRequest" ENABLE ROW LEVEL SECURITY;
```
정책(policy)은 만들지 않는다(문서 결정). NestJS는 postgres 역할로 우회하므로 정상 동작, 공개 API는 차단.

- [ ] **Step 4: 확인**

Run: `git status`
Expected: 두 package.json + pnpm-lock.yaml 변경됨

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json apps/api/package.json pnpm-lock.yaml
git commit -m "chore: supabase auth 패키지 설치 및 RLS 활성화"
```

---

## Task 1: api — kakao-profile 추출 함수 (TDD)

**Files:**
- Create: `apps/api/src/auth/kakao-profile.ts`
- Test: `apps/api/src/auth/kakao-profile.spec.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// apps/api/src/auth/kakao-profile.spec.ts
import { extractKakaoProfile } from './kakao-profile';

describe('extractKakaoProfile', () => {
  it('identities의 kakao id와 user_metadata.name을 뽑는다', () => {
    const user: any = {
      id: 'uuid-1',
      user_metadata: { name: '홍길동' },
      identities: [{ provider: 'kakao', id: '12345' }],
    };
    expect(extractKakaoProfile(user)).toEqual({ kakaoId: '12345', nickname: '홍길동' });
  });

  it('닉네임/provider id가 없으면 기본값(uid, 카카오사용자)을 쓴다', () => {
    const user: any = { id: 'uuid-1', user_metadata: {}, identities: [] };
    expect(extractKakaoProfile(user)).toEqual({ kakaoId: 'uuid-1', nickname: '카카오사용자' });
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter=@mulink/api test -- kakao-profile`
Expected: FAIL ("Cannot find module './kakao-profile'")

- [ ] **Step 3: 구현**

```ts
// apps/api/src/auth/kakao-profile.ts
import type { User } from '@supabase/supabase-js';

export interface KakaoProfile {
  kakaoId: string;
  nickname: string;
}

// ⚠️ user_metadata는 인가 판단에 쓰지 않는다. 닉네임 표시/최초 저장 용도만.
export function extractKakaoProfile(user: User): KakaoProfile {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const identity = user.identities?.find((i) => i.provider === 'kakao');
  const kakaoId =
    identity?.id ?? (meta.provider_id as string) ?? (meta.sub as string) ?? user.id;
  const nickname =
    (meta.name as string) ??
    (meta.full_name as string) ??
    (meta.nickname as string) ??
    (meta.preferred_username as string) ??
    '카카오사용자';
  return { kakaoId: String(kakaoId), nickname: String(nickname) };
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter=@mulink/api test -- kakao-profile`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/auth/kakao-profile.ts apps/api/src/auth/kakao-profile.spec.ts
git commit -m "feat(api): 카카오 프로필 추출 함수 추가"
```

---

## Task 2: api — SupabaseService (thin adapter)

**Files:** Create `apps/api/src/auth/supabase.service.ts`

> 네트워크 어댑터라 별도 단위 테스트 없이 구현(Guard/Controller 테스트에서 모킹).

- [ ] **Step 1: 구현**

```ts
// apps/api/src/auth/supabase.service.ts
import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private readonly client: SupabaseClient;

  constructor() {
    this.client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }

  // 토큰을 Supabase 서버에 위임 검증하고 유저를 돌려준다.
  getUser(accessToken: string) {
    return this.client.auth.getUser(accessToken);
  }
}
```

- [ ] **Step 2: 타입체크**

Run: `pnpm --filter=@mulink/api exec tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/auth/supabase.service.ts
git commit -m "feat(api): Supabase 토큰 검증 서비스 추가"
```

---

## Task 3: api — SupabaseAuthGuard (TDD)

**Files:**
- Create: `apps/api/src/auth/supabase-auth.guard.ts`
- Test: `apps/api/src/auth/supabase-auth.guard.spec.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// apps/api/src/auth/supabase-auth.guard.spec.ts
import { UnauthorizedException } from '@nestjs/common';
import { SupabaseAuthGuard } from './supabase-auth.guard';

function makeContext(headers: Record<string, string>) {
  const req: any = { headers };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as any;
}

describe('SupabaseAuthGuard', () => {
  it('Authorization 헤더가 없으면 401', async () => {
    const guard = new SupabaseAuthGuard({ getUser: jest.fn() } as any);
    await expect(guard.canActivate(makeContext({}))).rejects.toThrow(UnauthorizedException);
  });

  it('토큰이 유효하지 않으면 401', async () => {
    const supabase = {
      getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: { message: 'bad' } }),
    };
    const guard = new SupabaseAuthGuard(supabase as any);
    await expect(
      guard.canActivate(makeContext({ authorization: 'Bearer bad' })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('유효한 토큰이면 통과하고 request.user에 유저를 첨부한다', async () => {
    const user = { id: 'uuid-1' };
    const supabase = {
      getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }),
    };
    const guard = new SupabaseAuthGuard(supabase as any);
    const ctx = makeContext({ authorization: 'Bearer good' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(ctx.switchToHttp().getRequest().user).toBe(user);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter=@mulink/api test -- supabase-auth.guard`
Expected: FAIL ("Cannot find module './supabase-auth.guard'")

- [ ] **Step 3: 구현**

```ts
// apps/api/src/auth/supabase-auth.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from './supabase.service';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private readonly supabase: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('인증 토큰이 없습니다.');
    }
    const token = authHeader.slice('Bearer '.length);
    const { data, error } = await this.supabase.getUser(token);
    if (error || !data?.user) {
      throw new UnauthorizedException('유효하지 않은 토큰입니다.');
    }
    request.user = data.user;
    return true;
  }
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter=@mulink/api test -- supabase-auth.guard`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/auth/supabase-auth.guard.ts apps/api/src/auth/supabase-auth.guard.spec.ts
git commit -m "feat(api): Supabase JWT 검증 Guard 추가"
```

---

## Task 4: api — AuthController (TDD)

**Files:**
- Create: `apps/api/src/auth/auth.controller.ts`
- Test: `apps/api/src/auth/auth.controller.spec.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// apps/api/src/auth/auth.controller.spec.ts
import { NotFoundException } from '@nestjs/common';
import { AuthController } from './auth.controller';

describe('AuthController', () => {
  const prisma = { user: { upsert: jest.fn(), findUnique: jest.fn() } };
  const controller = new AuthController(prisma as any);
  const reqUser: any = {
    id: 'uuid-1',
    user_metadata: { name: '홍길동' },
    identities: [{ provider: 'kakao', id: '12345' }],
  };

  beforeEach(() => jest.clearAllMocks());

  it('sync: 토큰 유저로 User를 upsert 한다', async () => {
    prisma.user.upsert.mockResolvedValue({ id: 'uuid-1', nickname: '홍길동' });
    const result = await controller.sync({ user: reqUser } as any);
    expect(prisma.user.upsert).toHaveBeenCalledWith({
      where: { id: 'uuid-1' },
      create: { id: 'uuid-1', kakaoId: '12345', nickname: '홍길동' },
      update: {},
    });
    expect(result).toEqual({ id: 'uuid-1', nickname: '홍길동' });
  });

  it('me: DB의 User를 반환한다', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'uuid-1', nickname: '홍길동' });
    await expect(controller.me({ user: reqUser } as any)).resolves.toEqual({
      id: 'uuid-1',
      nickname: '홍길동',
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'uuid-1' } });
  });

  it('me: User가 없으면 404', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(controller.me({ user: reqUser } as any)).rejects.toThrow(NotFoundException);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter=@mulink/api test -- auth.controller`
Expected: FAIL ("Cannot find module './auth.controller'")

- [ ] **Step 3: 구현**

```ts
// apps/api/src/auth/auth.controller.ts
import {
  Controller,
  Get,
  NotFoundException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { extractKakaoProfile } from './kakao-profile';

type AuthedRequest = { user: SupabaseUser };

@Controller('auth')
@UseGuards(SupabaseAuthGuard)
export class AuthController {
  constructor(private readonly prisma: PrismaService) {}

  // 첫 로그인 시 호출: auth.users.id(UUID)로 public.User를 만든다.
  @Post('sync')
  async sync(@Req() req: AuthedRequest) {
    const { kakaoId, nickname } = extractKakaoProfile(req.user);
    return this.prisma.user.upsert({
      where: { id: req.user.id },
      create: { id: req.user.id, kakaoId, nickname },
      update: {},
    });
  }

  // 보호 엔드포인트: JWT 검증 후 내 User 반환.
  @Get('me')
  async me(@Req() req: AuthedRequest) {
    const user = await this.prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) throw new NotFoundException('유저를 찾을 수 없습니다.');
    return user;
  }
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter=@mulink/api test -- auth.controller`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/auth/auth.controller.ts apps/api/src/auth/auth.controller.spec.ts
git commit -m "feat(api): /auth/sync, /auth/me 엔드포인트 추가"
```

---

## Task 5: api — AuthModule 등록 + CORS

**Files:**
- Create: `apps/api/src/auth/auth.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/main.ts`

- [ ] **Step 1: AuthModule 작성**

```ts
// apps/api/src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { SupabaseService } from './supabase.service';
import { SupabaseAuthGuard } from './supabase-auth.guard';

@Module({
  controllers: [AuthController],
  providers: [SupabaseService, SupabaseAuthGuard],
})
export class AuthModule {}
```

- [ ] **Step 2: app.module.ts에 import 추가**

기존:
```ts
@Module({
  imports: [PrismaModule],
  controllers: [AppController],
  providers: [AppService],
})
```
수정 후(상단에 `import { AuthModule } from './auth/auth.module';` 추가):
```ts
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AppController],
  providers: [AppService],
})
```

- [ ] **Step 3: main.ts에 CORS 추가**

```ts
// apps/api/src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();
```

- [ ] **Step 4: 전체 api 테스트 + 빌드 확인**

Run: `pnpm --filter=@mulink/api test && pnpm --filter=@mulink/api exec tsc --noEmit`
Expected: 모든 테스트 PASS, 타입 에러 없음

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/auth/auth.module.ts apps/api/src/app.module.ts apps/api/src/main.ts
git commit -m "feat(api): AuthModule 등록 및 CORS 설정"
```

---

## Task 6: web — Supabase 클라이언트 유틸

**Files:**
- Create: `apps/web/src/shared/lib/supabase/client.ts`
- Create: `apps/web/src/shared/lib/supabase/server.ts`

> *적용(Vercel)*: `bundle-barrel-imports` — `@supabase/ssr`에서 필요한 함수만 직접 import.

- [ ] **Step 1: 브라우저 클라이언트**

```ts
// apps/web/src/shared/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
```

- [ ] **Step 2: 서버 클라이언트 (cookies는 Next 16에서 async)**

```ts
// apps/web/src/shared/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // 서버 컴포넌트에서 호출된 경우 — proxy가 세션을 갱신하므로 무시 가능
          }
        },
      },
    },
  );
}
```

- [ ] **Step 3: 타입체크**

Run: `pnpm --filter=@mulink/web exec tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/shared/lib/supabase/client.ts apps/web/src/shared/lib/supabase/server.ts
git commit -m "feat(web): Supabase 브라우저/서버 클라이언트 유틸 추가"
```

---

## Task 7: web — proxy(세션 갱신)

**Files:**
- Create: `apps/web/src/shared/lib/supabase/proxy-session.ts`
- Create: `apps/web/src/proxy.ts`

> ⚠️ Next.js 16: `middleware.ts`가 아니라 **`proxy.ts`**, 함수명 `proxy`. `src/` 바로 아래.

- [ ] **Step 1: 세션 갱신 유틸**

```ts
// apps/web/src/shared/lib/supabase/proxy-session.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // 만료된 Auth 토큰을 갱신한다(claims 검증 트리거).
  await supabase.auth.getClaims();

  return response;
}
```

- [ ] **Step 2: proxy.ts**

```ts
// apps/web/src/proxy.ts
import { type NextRequest } from 'next/server';
import { updateSession } from '@/shared/lib/supabase/proxy-session';

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

- [ ] **Step 3: 타입체크 + 빌드**

Run: `pnpm --filter=@mulink/web exec tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/shared/lib/supabase/proxy-session.ts apps/web/src/proxy.ts
git commit -m "feat(web): Next.js 16 proxy로 Supabase 세션 갱신"
```

---

## Task 8: web — 로그아웃 server action

**Files:** Create `apps/web/src/app/actions/auth.ts`

- [ ] **Step 1: 구현**

```ts
// apps/web/src/app/actions/auth.ts
'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/shared/lib/supabase/server';

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
```

- [ ] **Step 2: 타입체크**

Run: `pnpm --filter=@mulink/web exec tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/actions/auth.ts
git commit -m "feat(web): 로그아웃 server action 추가"
```

---

## Task 9: web — HomeAuth 프레젠테이션 컴포넌트 (TDD)

**Files:**
- Create: `apps/web/src/shared/ui/home-auth.tsx`
- Test: `apps/web/src/shared/ui/home-auth.test.tsx`

> *적용(Vercel)*: `server-serialization`(닉네임 문자열만 prop으로 받음), `rendering-conditional-render`(`&&` 아닌 삼항).

- [ ] **Step 1: 실패 테스트 작성**

```tsx
// apps/web/src/shared/ui/home-auth.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HomeAuth } from './home-auth';

vi.mock('@/app/actions/auth', () => ({ signOut: vi.fn() }));

describe('HomeAuth', () => {
  it('로그인 상태면 닉네임과 로그아웃 버튼을 보여준다', () => {
    render(<HomeAuth nickname="홍길동" />);
    expect(screen.getByText('환영합니다 홍길동님')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '로그아웃' })).toBeInTheDocument();
  });

  it('비로그인 상태면 로그인 링크를 보여준다', () => {
    render(<HomeAuth nickname={null} />);
    expect(screen.getByRole('link', { name: '로그인' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter=@mulink/web exec vitest run src/shared/ui/home-auth.test.tsx`
Expected: FAIL ("Failed to resolve import './home-auth'")

- [ ] **Step 3: 구현**

```tsx
// apps/web/src/shared/ui/home-auth.tsx
import Link from 'next/link';
import { Button } from '@/shared/ui/button';
import { signOut } from '@/app/actions/auth';

export function HomeAuth({ nickname }: { nickname: string | null }) {
  return nickname ? (
    <div className="space-y-4 text-center">
      <p className="text-lg">환영합니다 {nickname}님</p>
      <form action={signOut}>
        <Button type="submit" variant="outline">
          로그아웃
        </Button>
      </form>
    </div>
  ) : (
    <Button asChild>
      <Link href="/login">로그인</Link>
    </Button>
  );
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter=@mulink/web exec vitest run src/shared/ui/home-auth.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/shared/ui/home-auth.tsx apps/web/src/shared/ui/home-auth.test.tsx
git commit -m "feat(web): 로그인 상태 분기 HomeAuth 컴포넌트 추가"
```

---

## Task 10: web — 로그인 페이지 (TDD)

**Files:**
- Create: `apps/web/src/app/login/page.tsx`
- Test: `apps/web/src/app/login/page.test.tsx`

> *적용(Vercel)*: `bundle-barrel-imports`(Button/createClient 직접 import). 클라이언트 컴포넌트는 최소 의존만.

- [ ] **Step 1: 실패 테스트 작성**

```tsx
// apps/web/src/app/login/page.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LoginPage from './page';

const signInWithOAuth = vi.fn();
vi.mock('@/shared/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signInWithOAuth } }),
}));

describe('LoginPage', () => {
  it('카카오 시작하기 버튼을 렌더한다', () => {
    render(<LoginPage />);
    expect(screen.getByRole('button', { name: '카카오로 시작하기' })).toBeInTheDocument();
  });

  it('버튼 클릭 시 kakao provider로 OAuth를 호출한다', () => {
    render(<LoginPage />);
    fireEvent.click(screen.getByRole('button', { name: '카카오로 시작하기' }));
    expect(signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'kakao' }),
    );
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter=@mulink/web exec vitest run src/app/login/page.test.tsx`
Expected: FAIL ("Failed to resolve import './page'")

- [ ] **Step 3: 구현**

```tsx
// apps/web/src/app/login/page.tsx
'use client';

import { createClient } from '@/shared/lib/supabase/client';
import { Button } from '@/shared/ui/button';

export default function LoginPage() {
  const handleLogin = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  return (
    <main className="flex min-h-full items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6 rounded-lg border p-8">
        <h1 className="text-center text-xl font-semibold">MU:LINK 로그인</h1>
        <Button className="w-full" onClick={handleLogin}>
          카카오로 시작하기
        </Button>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter=@mulink/web exec vitest run src/app/login/page.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/login/page.tsx apps/web/src/app/login/page.test.tsx
git commit -m "feat(web): 카카오 로그인 페이지 추가"
```

---

## Task 11: web — OAuth 콜백 라우트

**Files:** Create `apps/web/src/app/auth/callback/route.ts`

> 콜백은 `exchangeCodeForSession`(세션 쿠키 저장) 후, 그 access_token으로 NestJS `POST /auth/sync`를 호출해 첫 로그인 User를 만든다. 두 작업은 순차 의존이라 직렬 처리한다.

- [ ] **Step 1: 구현**

```ts
// apps/web/src/app/auth/callback/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.session) {
      // 첫 로그인 시 NestJS에 User 동기화 (프론트는 DB 직접 접근 안 함)
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      });
      return NextResponse.redirect(`${origin}/`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
```

- [ ] **Step 2: 타입체크**

Run: `pnpm --filter=@mulink/web exec tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/auth/callback/route.ts
git commit -m "feat(web): OAuth 콜백에서 세션 교환 및 User 동기화"
```

---

## Task 12: web — 홈 페이지 수정 (세션 표시)

**Files:** Modify `apps/web/src/app/page.tsx` (기존 turbo 템플릿 내용 전체 교체)

> *적용(Vercel)*: `/auth/me` fetch는 유저별 동적 데이터라 `cache: 'no-store'`. HomeAuth엔 닉네임만 전달(`server-serialization`).
> 참고: 서버에서 forward할 access_token을 얻기 위해 `getSession()`을 쓴다 — NestJS가 `getUser`로 재검증하므로 안전하다.

- [ ] **Step 1: page.tsx 교체**

```tsx
// apps/web/src/app/page.tsx
import { createClient } from '@/shared/lib/supabase/server';
import { HomeAuth } from '@/shared/ui/home-auth';

async function getNickname(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const user = (await res.json()) as { nickname?: string };
  return user.nickname ?? null;
}

export default async function Home() {
  const nickname = await getNickname();
  return (
    <main className="flex min-h-full items-center justify-center p-6">
      <HomeAuth nickname={nickname} />
    </main>
  );
}
```

- [ ] **Step 2: 전체 web 테스트 + 빌드**

Run: `pnpm --filter=@mulink/web test && pnpm --filter=@mulink/web exec tsc --noEmit`
Expected: 모든 테스트 PASS, 타입 에러 없음

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/page.tsx
git commit -m "feat(web): 홈에서 로그인 상태 및 닉네임 표시"
```

---

## Task 13: End-to-end 수동 검증

**성공 기준(스펙)을 실제로 확인한다.**

- [ ] **Step 1: 두 앱 실행**

Run: `pnpm dev` (또는 `pnpm turbo dev --filter=@mulink/web` / `--filter=@mulink/api`)
Expected: web :3000, api :4000 기동

- [ ] **Step 2: 보호 엔드포인트가 토큰 없이 401인지**

Run: `curl -i http://localhost:4000/auth/me`
Expected: HTTP 401

- [ ] **Step 3: 브라우저 로그인 플로우**

브라우저 `http://localhost:3000/login` → "카카오로 시작하기" → 카카오 동의 → `/`로 복귀 → "환영합니다 {닉네임}님" 표시.
Expected: 닉네임이 보임

- [ ] **Step 4: DB 확인 (Supabase MCP `execute_sql` 또는 대시보드)**

```sql
select id, "kakaoId", nickname, role from "User";
```
Expected: `auth.users`의 UUID와 동일한 id로 row 1개 생성

- [ ] **Step 5: 로그아웃**

홈에서 "로그아웃" 클릭 → `/login`으로 이동, 홈 재방문 시 비로그인(로그인 링크) 표시.
Expected: 비로그인 상태로 표시

- [ ] **Step 6: 최종 커밋(필요 시 정리)**

```bash
git status   # 미커밋 변경 없는지 확인
```

---

## 자가 점검 메모

- 스펙 항목 대응: JWT 검증(Task 2·3), NestJS 경유 User 생성(Task 4·11), 보호 엔드포인트(Task 4), 홈 수정(Task 12), RLS(Task 0), proxy.ts(Task 7), TDD(api: Task 1·3·4 / web: Task 9·10).
- 타입 일관성: `extractKakaoProfile`→`{kakaoId,nickname}`, Guard가 `request.user`(SupabaseUser) 첨부, Controller가 동일 키로 소비.
- 환경변수: web `NEXT_PUBLIC_SUPABASE_URL`·`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`·`NEXT_PUBLIC_API_URL`, api `SUPABASE_URL`·`SUPABASE_PUBLISHABLE_KEY` — 설정·검증 완료.
- 버전 주의: @supabase/ssr API가 바뀔 수 있으니 설치 후 `createServerClient`/`getClaims` 시그니처를 한 번 확인.
