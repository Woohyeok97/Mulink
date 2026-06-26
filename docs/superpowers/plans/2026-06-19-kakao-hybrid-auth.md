# 카카오 하이브리드 인증 전환 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 카카오 인증만 NestJS가 직접 처리(scope 통제로 KOE205 회피)하고, 세션 발급·검증·유저저장소는 Supabase Auth를 그대로 쓰는 하이브리드 로그인으로 전환한다.

**Architecture:** web 로그인 버튼 → NestJS `/auth/kakao/login`(state 발급) → 카카오 동의 → NestJS `/auth/kakao/callback`(state 검증 → 카카오 토큰교환 → 유저정보 → Supabase admin `generateLink`+`verifyOtp`로 세션 발급 → 일회용 ticket 발급) → web `/auth/callback?ticket`(ticket으로 토큰 교환 → `setSession` 쿠키 기록 → `/auth/sync`) → 홈. 기존 가드/sync/me/ssr 쿠키 구조는 무수정 재사용.

**Tech Stack:** NestJS 11(Express), `@supabase/supabase-js@2.108.2`(admin: service_role), Prisma 7, Next.js 16 App Router, `@supabase/ssr@0.12.0`. 신규 패키지 설치 없음(Node 내장 `fetch`/`crypto` 사용).

**설계 스펙:** [docs/superpowers/specs/2026-06-19-kakao-hybrid-auth-design.md](../specs/2026-06-19-kakao-hybrid-auth-design.md)

---

## 전체 태스크 개요

| # | 태스크 | 위치 | 내용 |
|---|---|---|---|
| 1 | 환경변수 추가 | apps/api | 카카오/service_role 키 4개를 `.env`·`.env.example`에 추가 |
| 2 | SessionTicketService | apps/api | 일회용 ticket 저장소(메모리 Map, 30초 TTL) + 단위테스트 |
| 3 | KakaoOauthService | apps/api | 카카오 인가URL/토큰교환/유저정보 + 단위테스트 |
| 4 | SupabaseAdminService | apps/api | service_role로 generateLink→verifyOtp 세션발급 + 단위테스트 |
| 5 | KakaoAuthController | apps/api | login/callback/exchange 3개 라우트(state 쿠키 검증 포함) + 단위테스트 |
| 6 | AuthModule 등록 | apps/api | 신규 서비스/컨트롤러 등록 |
| 7 | web 로그인 버튼 전환 | apps/web | signInWithOAuth 제거 → NestJS login으로 이동 |
| 8 | web callback ticket 처리 | apps/web | code→ticket 교환 + setSession으로 교체 |
| 9 | 전체 검증 | 양쪽 | 타입체크·테스트·수동 E2E |

## 건드리는 파일 목록

**신규 (apps/api):**
- `apps/api/src/auth/session-ticket.service.ts` + `.spec.ts`
- `apps/api/src/auth/kakao-oauth.service.ts` + `.spec.ts`
- `apps/api/src/auth/supabase-admin.service.ts` + `.spec.ts`
- `apps/api/src/auth/kakao-auth.controller.ts` + `.spec.ts`
- `apps/api/src/auth/session.controller.ts` (exchange 라우트, 테스트는 controller.spec에 포함)

**수정 (apps/api):**
- [apps/api/src/auth/auth.module.ts](../../../apps/api/src/auth/auth.module.ts) — 신규 등록
- [apps/api/.env](../../../apps/api/.env) — 환경변수 4개 추가 (커밋 안 함)
- `apps/api/.env.example` — 키 이름만 추가 (없으면 생성)

**수정 (apps/web):**
- [apps/web/src/app/login/page.tsx](../../../apps/web/src/app/login/page.tsx) — 로그인 진입 방식 교체
- [apps/web/src/app/auth/callback/route.ts](../../../apps/web/src/app/auth/callback/route.ts) — code→ticket 처리로 교체

**무수정 (참고용, 재사용):**
- [apps/api/src/auth/auth.service.ts](../../../apps/api/src/auth/auth.service.ts) (sync/me)
- [apps/api/src/auth/kakao-profile.ts](../../../apps/api/src/auth/kakao-profile.ts) (extractKakaoProfile)
- [apps/api/src/auth/supabase-auth.guard.ts](../../../apps/api/src/auth/supabase-auth.guard.ts)
- [apps/api/src/auth/supabase.service.ts](../../../apps/api/src/auth/supabase.service.ts) (검증용)
- 기존 테스트 3개(auth.service/controller/guard.spec) — **수정 불필요**(로직 무변경, 메타 키 동일)

---

## Task 1: 환경변수 추가

**Files:**
- Modify: `apps/api/.env` (gitignore 대상, 커밋 안 함)
- Create/Modify: `apps/api/.env.example`

- [ ] **Step 1: `.env`에 4개 변수 추가**

`apps/api/.env` 끝에 추가(실제 값은 카카오 콘솔/Supabase 대시보드에서 발급받아 채운다):

```env
# 카카오 OAuth (NestJS 직접 처리)
KAKAO_REST_API_KEY=""
KAKAO_CLIENT_SECRET=""
KAKAO_REDIRECT_URI="http://localhost:4000/auth/kakao/callback"
# Supabase 세션 발급 (service_role — 서버 전용, 절대 web/NEXT_PUBLIC_ 금지)
SUPABASE_SERVICE_ROLE_KEY=""
# web으로 돌려보낼 주소(이미 WEB_ORIGIN 있으면 재사용)
WEB_ORIGIN="http://localhost:3000"
```

- [ ] **Step 2: `.env.example`에 키 이름만 추가**

`apps/api/.env.example`(없으면 생성)에 값 없이 키만:

```env
KAKAO_REST_API_KEY=
KAKAO_CLIENT_SECRET=
KAKAO_REDIRECT_URI=http://localhost:4000/auth/kakao/callback
SUPABASE_SERVICE_ROLE_KEY=
WEB_ORIGIN=http://localhost:3000
```

- [ ] **Step 3: 커밋**

```bash
git add apps/api/.env.example
git commit -m "chore(api): 카카오 하이브리드 인증 환경변수 예시 추가"
```

---

## Task 2: SessionTicketService (일회용 교환권 저장소)

NestJS가 발급한 세션 토큰을 메모리에 잠깐 보관하고, web에는 1회용 ticket만 넘긴다.

**Files:**
- Create: `apps/api/src/auth/session-ticket.service.ts`
- Test: `apps/api/src/auth/session-ticket.service.spec.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/api/src/auth/session-ticket.service.spec.ts`:

```typescript
import { SessionTicketService } from './session-ticket.service';

describe('SessionTicketService', () => {
  it('issue 후 consume하면 토큰을 돌려준다', () => {
    const service = new SessionTicketService();
    const tokens = { accessToken: 'a', refreshToken: 'r' };
    const ticket = service.issue(tokens);
    expect(service.consume(ticket)).toEqual(tokens);
  });

  it('consume은 1회용이라 두 번째는 null', () => {
    const service = new SessionTicketService();
    const ticket = service.issue({ accessToken: 'a', refreshToken: 'r' });
    service.consume(ticket);
    expect(service.consume(ticket)).toBeNull();
  });

  it('없는 ticket은 null', () => {
    const service = new SessionTicketService();
    expect(service.consume('nope')).toBeNull();
  });

  it('만료된 ticket은 null', () => {
    const service = new SessionTicketService();
    const ticket = service.issue({ accessToken: 'a', refreshToken: 'r' }, 0);
    // ttl 0초 → 발급 즉시 만료
    expect(service.consume(ticket)).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter=@mulink/api test -- session-ticket`
Expected: FAIL ("Cannot find module './session-ticket.service'")

- [ ] **Step 3: 최소 구현 작성**

`apps/api/src/auth/session-ticket.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

// web으로 넘길 세션 토큰 한 쌍.
export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

// 토큰을 URL에 노출하지 않으려고, 진짜 토큰은 서버 메모리에 잠깐 두고
// web에는 1회용 ticket만 넘긴다. (호텔 프런트가 열쇠 대신 교환권을 주는 방식)
@Injectable()
export class SessionTicketService {
  private readonly store = new Map<string, { tokens: SessionTokens; expiresAt: number }>();

  // 토큰을 저장하고 ticket을 돌려준다. 기본 30초 후 만료.
  issue(tokens: SessionTokens, ttlSeconds = 30): string {
    const ticket = randomUUID();
    this.store.set(ticket, { tokens, expiresAt: Date.now() + ttlSeconds * 1000 });
    return ticket;
  }

  // ticket으로 토큰을 1회 꺼낸다. 꺼내면 즉시 삭제. 없거나 만료면 null.
  consume(ticket: string): SessionTokens | null {
    const entry = this.store.get(ticket);
    if (!entry) return null;
    this.store.delete(ticket);
    if (Date.now() >= entry.expiresAt) return null;
    return entry.tokens;
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter=@mulink/api test -- session-ticket`
Expected: PASS (4 passed)

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src/auth/session-ticket.service.ts apps/api/src/auth/session-ticket.service.spec.ts
git commit -m "feat(api): 일회용 세션 교환권 저장소(SessionTicketService) 추가"
```

---

## Task 3: KakaoOauthService (카카오 OAuth 통신)

카카오와의 대화(인가URL 생성 / code→토큰 / 유저정보)만 책임진다.

**Files:**
- Create: `apps/api/src/auth/kakao-oauth.service.ts`
- Test: `apps/api/src/auth/kakao-oauth.service.spec.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/api/src/auth/kakao-oauth.service.spec.ts`:

```typescript
import { KakaoOauthService } from './kakao-oauth.service';

describe('KakaoOauthService', () => {
  const ORIGINAL_ENV = process.env;
  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      KAKAO_REST_API_KEY: 'rest-key',
      KAKAO_CLIENT_SECRET: 'secret',
      KAKAO_REDIRECT_URI: 'http://localhost:4000/auth/kakao/callback',
    };
  });
  afterEach(() => {
    process.env = ORIGINAL_ENV;
    jest.restoreAllMocks();
  });

  it('buildAuthorizeUrl: scope에 account_email 없이 profile만 포함한다', () => {
    const service = new KakaoOauthService();
    const url = service.buildAuthorizeUrl('state-123');
    expect(url).toContain('https://kauth.kakao.com/oauth/authorize');
    expect(url).toContain('client_id=rest-key');
    expect(url).toContain('state=state-123');
    expect(url).toContain('scope=profile_nickname+profile_image');
    expect(url).not.toContain('account_email');
  });

  it('exchangeCodeForToken: code로 카카오 access_token을 받는다', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'kakao-access' }),
    } as Response);
    const service = new KakaoOauthService();
    const token = await service.exchangeCodeForToken('the-code');
    expect(token).toBe('kakao-access');
  });

  it('fetchUserInfo: kakaoId와 nickname을 추출한다', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 4821,
        kakao_account: { profile: { nickname: '홍길동' } },
      }),
    } as Response);
    const service = new KakaoOauthService();
    const profile = await service.fetchUserInfo('kakao-access');
    expect(profile).toEqual({ kakaoId: '4821', nickname: '홍길동' });
  });

  it('fetchUserInfo: nickname 없으면 카카오사용자 폴백', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ id: 4821, kakao_account: {} }),
    } as Response);
    const service = new KakaoOauthService();
    const profile = await service.fetchUserInfo('kakao-access');
    expect(profile).toEqual({ kakaoId: '4821', nickname: '카카오사용자' });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter=@mulink/api test -- kakao-oauth`
Expected: FAIL ("Cannot find module './kakao-oauth.service'")

- [ ] **Step 3: 최소 구현 작성**

`apps/api/src/auth/kakao-oauth.service.ts`:

```typescript
import { Injectable, InternalServerErrorException } from '@nestjs/common';

// 카카오에서 받은 유저 식별 정보. (auth.users 메타에 실어 기존 추출 로직과 연결)
export interface KakaoProfile {
  kakaoId: string;
  nickname: string;
}

// 카카오 OAuth 서버와의 통신만 담당한다.
// scope를 직접 지정해 account_email을 빼는 것이 이 전환의 핵심.
@Injectable()
export class KakaoOauthService {
  private readonly restApiKey = process.env.KAKAO_REST_API_KEY!;
  private readonly clientSecret = process.env.KAKAO_CLIENT_SECRET!;
  private readonly redirectUri = process.env.KAKAO_REDIRECT_URI!;

  // 1단계: 사용자를 보낼 카카오 동의 화면 URL. state로 CSRF 방어.
  buildAuthorizeUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.restApiKey,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'profile_nickname profile_image', // account_email 없음
      state,
    });
    return `https://kauth.kakao.com/oauth/authorize?${params.toString()}`;
  }

  // 2단계: 카카오가 준 code를 카카오 access_token으로 교환.
  async exchangeCodeForToken(code: string): Promise<string> {
    const res = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.restApiKey,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        code,
      }),
    });
    if (!res.ok) throw new InternalServerErrorException('카카오 토큰 교환 실패');
    const data = (await res.json()) as { access_token: string };
    return data.access_token;
  }

  // 3단계: access_token으로 카카오 유저 정보 조회 → kakaoId/nickname.
  async fetchUserInfo(kakaoAccessToken: string): Promise<KakaoProfile> {
    const res = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${kakaoAccessToken}` },
    });
    if (!res.ok) throw new InternalServerErrorException('카카오 유저 정보 조회 실패');
    const data = (await res.json()) as {
      id: number;
      kakao_account?: { profile?: { nickname?: string } };
    };
    return {
      kakaoId: String(data.id),
      nickname: data.kakao_account?.profile?.nickname ?? '카카오사용자',
    };
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter=@mulink/api test -- kakao-oauth`
Expected: PASS (4 passed)

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src/auth/kakao-oauth.service.ts apps/api/src/auth/kakao-oauth.service.spec.ts
git commit -m "feat(api): 카카오 OAuth 통신 서비스(KakaoOauthService) 추가"
```

---

## Task 4: SupabaseAdminService (세션 발급)

service_role 키로 Supabase에 유저 생성(자동) + 세션 발급. 검증용 `SupabaseService`와 키·권한이 달라 별도 파일로 분리한다.

**Files:**
- Create: `apps/api/src/auth/supabase-admin.service.ts`
- Test: `apps/api/src/auth/supabase-admin.service.spec.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`hashed_token`(응답) → `token_hash`(verifyOtp 파라미터) 매핑이 핵심 함정이라 이걸 검증한다.

`apps/api/src/auth/supabase-admin.service.spec.ts`:

```typescript
import { SupabaseAdminService } from './supabase-admin.service';

describe('SupabaseAdminService', () => {
  it('generateLink의 hashed_token을 verifyOtp의 token_hash로 넘겨 세션을 발급한다', async () => {
    const generateLink = jest.fn().mockResolvedValue({
      data: { properties: { hashed_token: 'hash-xyz' } },
      error: null,
    });
    const verifyOtp = jest.fn().mockResolvedValue({
      data: { session: { access_token: 'AT', refresh_token: 'RT' } },
      error: null,
    });
    const fakeClient: any = { auth: { admin: { generateLink }, verifyOtp } };

    const service = new SupabaseAdminService();
    // 내부 client를 테스트용으로 주입
    (service as any).client = fakeClient;

    const tokens = await service.issueSession({ kakaoId: '4821', nickname: '홍길동' });

    // 합성 이메일로 magiclink 생성
    expect(generateLink).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'magiclink',
        email: '4821@kakao.local',
        options: expect.objectContaining({
          data: { provider: 'kakao', provider_id: '4821', name: '홍길동' },
        }),
      }),
    );
    // 응답 hashed_token → 파라미터 token_hash 매핑 검증 (오타 회귀 방지)
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: 'hash-xyz', type: 'magiclink' });
    expect(tokens).toEqual({ accessToken: 'AT', refreshToken: 'RT' });
  });

  it('generateLink 실패 시 에러를 던진다', async () => {
    const fakeClient: any = {
      auth: {
        admin: { generateLink: jest.fn().mockResolvedValue({ data: null, error: { message: 'x' } }) },
        verifyOtp: jest.fn(),
      },
    };
    const service = new SupabaseAdminService();
    (service as any).client = fakeClient;
    await expect(
      service.issueSession({ kakaoId: '1', nickname: 'n' }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter=@mulink/api test -- supabase-admin`
Expected: FAIL ("Cannot find module './supabase-admin.service'")

- [ ] **Step 3: 최소 구현 작성**

`apps/api/src/auth/supabase-admin.service.ts`:

```typescript
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import ws from 'ws';
import type { SessionTokens } from './session-ticket.service';
import type { KakaoProfile } from './kakao-oauth.service';

// service_role 키로 동작하는 관리자 클라이언트.
// ⚠️ 이 키는 DB 전체 권한이라 서버에서만 쓴다. (검증용 SupabaseService와 분리)
@Injectable()
export class SupabaseAdminService {
  private client: SupabaseClient = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      // Node 20은 네이티브 WebSocket이 없어 ws를 transport로 주입한다.
      realtime: { transport: ws as never },
    },
  );

  // 카카오 프로필로 Supabase 세션(access/refresh)을 발급한다.
  // 1) 합성 이메일로 magiclink 생성 (유저 없으면 자동 생성·있으면 재사용 = 멱등)
  // 2) 거기서 나온 hashed_token을 verifyOtp(token_hash)로 검증해 세션 획득
  async issueSession(profile: KakaoProfile): Promise<SessionTokens> {
    const email = `${profile.kakaoId}@kakao.local`;

    const { data: linkData, error: linkError } = await this.client.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        // user_metadata에 실어두면 verifyOtp가 만든 User에 반영되어
        // 기존 extractKakaoProfile(provider_id/name)이 그대로 읽는다.
        data: { provider: 'kakao', provider_id: profile.kakaoId, name: profile.nickname },
      },
    });
    if (linkError || !linkData) {
      throw new InternalServerErrorException('Supabase 매직링크 생성 실패');
    }

    // ⚠️ 응답 필드는 hashed_token, verifyOtp 파라미터는 token_hash (이름 다름)
    const { data: otpData, error: otpError } = await this.client.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: 'magiclink',
    });
    if (otpError || !otpData.session) {
      throw new InternalServerErrorException('Supabase 세션 발급 실패');
    }

    return {
      accessToken: otpData.session.access_token,
      refreshToken: otpData.session.refresh_token,
    };
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter=@mulink/api test -- supabase-admin`
Expected: PASS (2 passed)

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src/auth/supabase-admin.service.ts apps/api/src/auth/supabase-admin.service.spec.ts
git commit -m "feat(api): service_role 세션 발급 서비스(SupabaseAdminService) 추가"
```

---

## Task 5: KakaoAuthController + SessionController (login / callback / exchange 라우트)

카카오 라우트(`auth/kakao/*`)와 ticket 교환 라우트(`auth/session/exchange`)를 만든다. 경로
prefix가 달라 컨트롤러를 둘로 나눈다(`auth/kakao`, `auth/session`). 로그인 전이라 토큰이 없으므로
`SupabaseAuthGuard`를 적용하지 않는다(기존 `AuthController`와 별도인 이유).

**Files:**
- Create: `apps/api/src/auth/kakao-auth.controller.ts`
- Create: `apps/api/src/auth/session.controller.ts`
- Test: `apps/api/src/auth/kakao-auth.controller.spec.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

Express `Response`(쿠키/redirect)와 세 서비스를 mock으로 검증한다.

`apps/api/src/auth/kakao-auth.controller.spec.ts`:

```typescript
import type { Response } from 'express';
import { KakaoAuthController } from './kakao-auth.controller';
import { SessionController } from './session.controller';

function makeRes() {
  return {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
    redirect: jest.fn(),
  } as unknown as Response;
}

describe('KakaoAuthController', () => {
  const kakao = {
    buildAuthorizeUrl: jest.fn(),
    exchangeCodeForToken: jest.fn(),
    fetchUserInfo: jest.fn(),
  } as any;
  const admin = { issueSession: jest.fn() } as any;
  const tickets = { issue: jest.fn(), consume: jest.fn() } as any;
  const controller = new KakaoAuthController(kakao, admin, tickets);
  const session = new SessionController(tickets);

  beforeEach(() => jest.clearAllMocks());

  it('login: state 쿠키를 굽고 카카오로 redirect 한다', () => {
    kakao.buildAuthorizeUrl.mockReturnValue('https://kauth.kakao.com/x');
    const res = makeRes();
    controller.login(res);
    expect(res.cookie).toHaveBeenCalledWith(
      'kakao_oauth_state',
      expect.any(String),
      expect.objectContaining({ httpOnly: true, sameSite: 'lax' }),
    );
    expect(res.redirect).toHaveBeenCalledWith('https://kauth.kakao.com/x');
  });

  it('callback: state 불일치면 error=state로 redirect', async () => {
    const res = makeRes();
    await controller.callback('code1', 'BAD', 'GOOD', res);
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('/login?error=state'));
  });

  it('callback: 정상 흐름이면 ticket을 달아 web callback으로 redirect', async () => {
    kakao.exchangeCodeForToken.mockResolvedValue('kakao-access');
    kakao.fetchUserInfo.mockResolvedValue({ kakaoId: '4821', nickname: '홍길동' });
    admin.issueSession.mockResolvedValue({ accessToken: 'AT', refreshToken: 'RT' });
    tickets.issue.mockReturnValue('ticket-1');
    const res = makeRes();
    await controller.callback('code1', 'GOOD', 'GOOD', res);
    expect(admin.issueSession).toHaveBeenCalledWith({ kakaoId: '4821', nickname: '홍길동' });
    expect(res.clearCookie).toHaveBeenCalledWith('kakao_oauth_state');
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('/auth/callback?ticket=ticket-1'));
  });

  it('exchange: ticket이 유효하면 토큰을 반환', () => {
    tickets.consume.mockReturnValue({ accessToken: 'AT', refreshToken: 'RT' });
    expect(session.exchange({ ticket: 'ticket-1' })).toEqual({
      accessToken: 'AT',
      refreshToken: 'RT',
    });
  });

  it('exchange: ticket이 없거나 만료면 401', () => {
    tickets.consume.mockReturnValue(null);
    expect(() => session.exchange({ ticket: 'x' })).toThrow();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter=@mulink/api test -- kakao-auth.controller`
Expected: FAIL ("Cannot find module './kakao-auth.controller'")

- [ ] **Step 3: 최소 구현 작성**

`apps/api/src/auth/kakao-auth.controller.ts`:

```typescript
import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';
import { KakaoOauthService } from './kakao-oauth.service';
import { SupabaseAdminService } from './supabase-admin.service';
import { SessionTicketService } from './session-ticket.service';

const STATE_COOKIE = 'kakao_oauth_state';

// 카카오 하이브리드 로그인 라우트. 로그인 전이라 가드를 적용하지 않는다.
@Controller('auth/kakao')
export class KakaoAuthController {
  constructor(
    private readonly kakao: KakaoOauthService,
    private readonly admin: SupabaseAdminService,
    private readonly tickets: SessionTicketService,
  ) {}

  // GET /auth/kakao/login — state를 쿠키에 굽고 카카오 동의 화면으로 보낸다.
  @Get('login')
  login(@Res() res: Response): void {
    const state = randomUUID();
    res.cookie(STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 5 * 60 * 1000, // 5분
    });
    res.redirect(this.kakao.buildAuthorizeUrl(state));
  }

  // GET /auth/kakao/callback — 카카오가 code+state를 돌려보내는 곳.
  // @Query state(카카오) vs 쿠키 state 대조로 CSRF를 막는다.
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    // 쿠키는 main.ts의 cookie-parser로 주입 (Task 6에서 등록)
    @Res() res: Response & { cookies?: Record<string, string> } & any,
  ): Promise<void> {
    const cookieState = (res.req?.cookies?.[STATE_COOKIE] as string) ?? '';
    const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';

    if (!state || !cookieState || state !== cookieState) {
      res.redirect(`${webOrigin}/login?error=state`);
      return;
    }
    res.clearCookie(STATE_COOKIE);

    try {
      const kakaoToken = await this.kakao.exchangeCodeForToken(code);
      const profile = await this.kakao.fetchUserInfo(kakaoToken);
      const tokens = await this.admin.issueSession(profile);
      const ticket = this.tickets.issue(tokens);
      res.redirect(`${webOrigin}/auth/callback?ticket=${ticket}`);
    } catch {
      res.redirect(`${webOrigin}/login?error=session`);
    }
  }
}
```

- [ ] **Step 3b: exchange 컨트롤러 작성**

`apps/api/src/auth/session.controller.ts`:

```typescript
import { Body, Controller, Post, UnauthorizedException } from '@nestjs/common';
import { SessionTicketService, type SessionTokens } from './session-ticket.service';

// POST /auth/session/exchange — web이 ticket으로 세션 토큰을 받아가는 곳.
// 카카오 라우트와 prefix가 달라 별도 컨트롤러로 둔다. 가드 미적용(로그인 완료 직전 단계).
@Controller('auth/session')
export class SessionController {
  constructor(private readonly tickets: SessionTicketService) {}

  @Post('exchange')
  exchange(@Body() body: { ticket: string }): SessionTokens {
    const tokens = this.tickets.consume(body.ticket);
    if (!tokens) throw new UnauthorizedException('만료되었거나 유효하지 않은 ticket');
    return tokens;
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter=@mulink/api test -- kakao-auth.controller`
Expected: PASS (5 passed)

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src/auth/kakao-auth.controller.ts apps/api/src/auth/session.controller.ts apps/api/src/auth/kakao-auth.controller.spec.ts
git commit -m "feat(api): 카카오 로그인·ticket 교환 라우트 추가"
```

---

## Task 6: AuthModule 등록 + cookie-parser

신규 서비스/컨트롤러를 모듈에 등록하고, state 쿠키를 읽기 위해 cookie-parser를 켠다.

**Files:**
- Modify: `apps/api/src/auth/auth.module.ts`
- Modify: `apps/api/src/main.ts`

- [ ] **Step 1: cookie-parser 설치 여부 확인**

Run: `ls apps/api/node_modules/cookie-parser 2>/dev/null && echo 있음 || echo 없음`

없으면 **설치 전 사용자에게 확인**(프로젝트 규칙). 확인 후:
`pnpm --filter=@mulink/api add cookie-parser && pnpm --filter=@mulink/api add -D @types/cookie-parser`

- [ ] **Step 2: main.ts에 cookie-parser 적용**

`apps/api/src/main.ts`의 `enableCors` 위에 추가:

```typescript
import cookieParser from 'cookie-parser';
// ...
const app = await NestFactory.create(AppModule);
app.use(cookieParser());
app.enableCors({
  origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
  credentials: true,
});
```

- [ ] **Step 3: auth.module.ts에 등록**

`apps/api/src/auth/auth.module.ts`를 다음으로 교체:

```typescript
import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { KakaoAuthController } from './kakao-auth.controller';
import { SessionController } from './session.controller';
import { KakaoOauthService } from './kakao-oauth.service';
import { SupabaseAdminService } from './supabase-admin.service';
import { SessionTicketService } from './session-ticket.service';

// auth 관련된 모든 것을 하나로 묶는 Module
@Module({
  controllers: [AuthController, KakaoAuthController, SessionController],
  providers: [
    AuthService,
    SupabaseService,
    SupabaseAuthGuard,
    KakaoOauthService,
    SupabaseAdminService,
    SessionTicketService,
  ],
})
export class AuthModule {}
```

- [ ] **Step 4: 빌드·테스트로 회귀 확인**

Run: `pnpm --filter=@mulink/api check-types && pnpm --filter=@mulink/api test`
Expected: 타입체크 통과 + 기존/신규 전체 테스트 PASS

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src/auth/auth.module.ts apps/api/src/main.ts apps/api/package.json
git commit -m "feat(api): 카카오 인증 모듈 등록 및 cookie-parser 적용"
```

---

## Task 7: web 로그인 버튼 전환

`signInWithOAuth('kakao')`를 제거하고 NestJS login 라우트로 이동시킨다.

**Files:**
- Modify: `apps/web/src/app/login/page.tsx`

- [ ] **Step 1: 로그인 진입 방식 교체**

`apps/web/src/app/login/page.tsx`를 다음으로 교체:

```tsx
'use client';

import { Button } from '@/shared/ui/button';

export default function LoginPage() {
  // 카카오 인증은 NestJS가 직접 처리한다. 버튼을 누르면 NestJS의 로그인 진입점으로
  // 이동하고, 거기서 카카오 동의 화면으로 redirect 된다.
  const handleLogin = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/auth/kakao/login`;
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

- [ ] **Step 2: 타입체크**

Run: `pnpm --filter=@mulink/web check-types`
Expected: PASS (createClient import 제거로 미사용 경고도 없어야 함)

- [ ] **Step 3: 커밋**

```bash
git add apps/web/src/app/login/page.tsx
git commit -m "feat(web): 카카오 로그인을 NestJS 진입점으로 전환"
```

---

## Task 8: web callback ticket 처리

기존 `/auth/callback`이 `code` 대신 `ticket`을 받아, NestJS에서 토큰을 교환하고 `setSession`으로 쿠키에 심는다. sync/redirect 패턴은 유지.

**Files:**
- Modify: `apps/web/src/app/auth/callback/route.ts`

- [ ] **Step 1: callback 라우트 교체**

`apps/web/src/app/auth/callback/route.ts`를 다음으로 교체:

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const ticket = searchParams.get('ticket');

  if (ticket) {
    // 1) ticket으로 NestJS에서 세션 토큰을 받아온다 (서버↔서버).
    const exchangeRes = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/auth/session/exchange`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket }),
      },
    );
    if (!exchangeRes.ok) {
      return NextResponse.redirect(`${origin}/login?error=expired`);
    }
    const { accessToken, refreshToken } = (await exchangeRes.json()) as {
      accessToken: string;
      refreshToken: string;
    };

    // 2) 받은 토큰을 ssr 쿠키 세션에 심는다.
    const supabase = await createClient();
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) {
      return NextResponse.redirect(`${origin}/login?error=session`);
    }

    // 3) 첫 로그인 시 public.User 동기화 (기존 패턴 그대로).
    const syncRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/sync`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (syncRes.ok) {
      return NextResponse.redirect(`${origin}/`);
    }
    return NextResponse.redirect(`${origin}/login?error=sync`);
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
```

- [ ] **Step 2: 타입체크**

Run: `pnpm --filter=@mulink/web check-types`
Expected: PASS

- [ ] **Step 3: 커밋**

```bash
git add apps/web/src/app/auth/callback/route.ts
git commit -m "feat(web): callback에서 ticket 교환 후 setSession으로 세션 주입"
```

---

## Task 9: 전체 검증 (타입·테스트·수동 E2E)

**Files:** 없음(검증만)

- [ ] **Step 1: 전체 타입체크·테스트**

Run: `pnpm check-types && pnpm --filter=@mulink/api test`
Expected: 전부 PASS

- [ ] **Step 2: 인프라 설정 확인 (코드 아님)**

- 카카오 디벨로퍼스: Redirect URI에 `http://localhost:4000/auth/kakao/callback` 등록, 동의항목 profile_nickname/profile_image만(account_email 제거)
- `apps/api/.env`의 4개 키 실제 값 채움
- Supabase 대시보드: Kakao Provider disable(선택)

- [ ] **Step 3: 수동 E2E**

Run: `pnpm dev`

1. `http://localhost:3000/login` → "카카오로 시작하기"
2. 카카오 동의창에 **account_email 없이** 프로필만 표시 → KOE205 미발생 확인
3. 동의 → `/`로 돌아와 "환영합니다 {닉네임}님" 표시
4. 새로고침 → 로그인 유지(쿠키 세션), `/auth/me` 200
5. 로그아웃 → 재로그인 시 같은 유저(kakaoId 동일, public.User row 동일)
6. (선택) `curl -X POST localhost:4000/auth/session/exchange -d '{"ticket":"임의값"}' -H 'Content-Type: application/json'` → 401 확인

- [ ] **Step 4: 최종 커밋(필요 시)**

E2E 중 수정이 있었다면 커밋. 없으면 생략.

---

## 기존 테스트 영향 분석 (수정 불필요 근거)

- `auth.service.spec.ts` / `auth.controller.spec.ts`: `sync`/`me` 로직 무변경. mock이 쓰는
  `user_metadata.name` / `identities[].id` 구조를 `SupabaseAdminService`가 `generateLink`의
  `data`(provider_id/name)로 동일하게 채우므로 그대로 통과.
- `supabase-auth.guard.spec.ts`: 가드 무수정 → 그대로 통과.
- 따라서 **기존 테스트는 수정하지 않는다.** Task 6 Step 4 / Task 9 Step 1에서 회귀를 확인한다.
