# 카카오 로그인(Supabase Auth) 임시 구현 — 설계 스펙

작성일: 2026-06-17 / 브랜치: feature/auth

## Context (왜 이 작업을 하는가)

MU:LINK의 인증을 붙이는 첫 단계다. 기술 결정 문서(`docs/뮤링_기술결정_v2.md`)에서 **"인증은 Supabase Auth(카카오 OAuth + JWT 발급), 인가/비즈니스 로직은 NestJS, 데이터 접근은 Prisma, 프론트는 DB에 직접 안 붙고 NestJS API만 경유"** 로 아키텍처를 확정했다. 이번 작업은 이 흐름을 **임시로(디자인 시안 없이 최소 UI)** 끝에서 끝까지 동작시켜, Next.js ↔ NestJS 인증 흐름이 실제로 도는 것을 검증하는 것이 목표다.

이미 준비된 것: `User.id`가 UUID로 마이그레이션됨(auth.users.id와 1:1), Supabase Postgres 연결, web=vitest / api=jest 테스트 셋업, env(web/api의 `SUPABASE_URL`·publishable key, `NEXT_PUBLIC_API_URL`) 설정 및 검증 완료.

## 확정된 결정

- **JWT 검증**: NestJS에서 `supabase.auth.getUser(token)` (Supabase 서버 위임, 단순·안전)
- **유저 생성**: NestJS 엔드포인트 경유 (`POST /auth/sync` upsert) — 문서의 "프론트는 NestJS만 경유" 원칙
- **로그인 후 화면**: 기존 홈(`src/app/page.tsx`) 직접 수정
- **개발 방식**: TDD — web=vitest, api=jest (실패 테스트 → 구현 → 통과)
- **범위**: 로그인 + 유저 생성 + 보호 엔드포인트 1개(`GET /auth/me`). role Guard는 범위 제외(role은 기본 STUDENT)

## 인증 흐름

```
[브라우저] /login "카카오로 시작하기"
  → supabase.auth.signInWithOAuth({ provider:'kakao', options:{ redirectTo: /auth/callback } })
  → 카카오 동의 → Supabase Auth가 JWT(access/refresh) 발급 → 리다이렉트 /auth/callback?code=...

[Next 서버] /auth/callback (route handler)
  → exchangeCodeForSession(code)  // 세션 쿠키 저장
  → 그 세션의 access_token으로 NestJS POST /auth/sync 호출 (첫 로그인 시 User row 생성)
  → / 로 리다이렉트

[홈 /] (서버 컴포넌트)
  → 세션 확인 → access_token으로 NestJS GET /auth/me 호출 → "환영합니다 {닉네임}" + 로그아웃
  → 비로그인 시 /login 링크

[매 요청] src/proxy.ts 가 만료 토큰 자동 갱신
```

## 구현 상세

### 백엔드 (apps/api) — 새 AuthModule

- `src/auth/supabase.service.ts` — `@supabase/supabase-js` 클라이언트 1개 보관(env `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`). `getUser(token)` 래핑.
- `src/auth/supabase-auth.guard.ts` — `Authorization: Bearer <jwt>` 추출 → `getUser` 검증 → `request.user`(Supabase 유저) 첨부. 실패 시 401.
- `src/auth/auth.controller.ts`
  - `POST /auth/sync` (Guard) — 토큰의 유저에서 `kakaoId`(provider id: `identities[].id` 또는 `user_metadata.provider_id`), `nickname`(`user_metadata`의 name/full_name/nickname 폴백) 추출 → `prisma.user.upsert({ where:{id}, create:{id,kakaoId,nickname}, update:{} })` → User 반환.
  - `GET /auth/me` (Guard) — uid로 `prisma.user.findUnique` → 반환(없으면 404). **보호 엔드포인트 시연용.**
- `src/auth/auth.module.ts` — controller/guard/service 등록. `app.module.ts`에 import.
- `src/main.ts` — 로컬 CORS 활성화(web origin).
- 주의: Prisma Client는 `apps/api/generated/prisma`에서 import(기존 PrismaService 패턴 따름). DB 접근은 PrismaService 경유.
- ⚠️ 보안: `user_metadata`는 인가 판단에 쓰지 않는다(여기선 닉네임 표시·최초 저장 용도만). role은 DB 기본값.

대표 파일: `apps/api/src/auth/auth.controller.ts`, `apps/api/src/auth/supabase-auth.guard.ts`, `apps/api/src/auth/supabase.service.ts`

### 프론트 (apps/web) — Next.js 16

- `src/shared/lib/supabase/client.ts` — `createBrowserClient` (env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`)
- `src/shared/lib/supabase/server.ts` — `createServerClient` + Next `cookies()` (getAll/setAll)
- `src/proxy.ts` — ⚠️ **Next.js 16: `middleware.ts` 아니라 `proxy.ts`** (함수명 `proxy`, `src/` 위치). 매 요청 세션 토큰 갱신(`getClaims`).
- `src/app/login/page.tsx` — 클라이언트 컴포넌트. 카드 + shadcn `Button` "카카오로 시작하기" → `signInWithOAuth`. UI 최소.
- `src/app/auth/callback/route.ts` — `exchangeCodeForSession` → 그 토큰으로 NestJS `POST /auth/sync` 호출 → `/` 리다이렉트.
- `src/app/page.tsx` (기존 홈 수정) — 서버에서 세션 확인 → 로그인 시 NestJS `GET /auth/me`로 닉네임 받아 표시 + 로그아웃 버튼, 비로그인 시 `/login` 링크.
- 로그아웃 — `signOut()` 처리하는 server action.
- API 호출은 모두 **Next 서버 측**(callback route, 서버 컴포넌트)에서 `NEXT_PUBLIC_API_URL` 사용.

대표 파일: `apps/web/src/app/login/page.tsx`, `apps/web/src/app/auth/callback/route.ts`, `apps/web/src/proxy.ts`, `apps/web/src/shared/lib/supabase/*`

### 보안 (RLS)

문서 결정대로 `User`, `LessonRequest`에 **RLS는 켜되 정책은 안 만든다**. NestJS는 postgres 역할로 우회(정상), Supabase 공개 API는 차단. → `ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;` (LessonRequest 동일) 실행(MCP `execute_sql` 또는 마이그레이션).

## 설치 패키지 (설치 전 사용자 확인)

- `apps/web`: `@supabase/supabase-js`, `@supabase/ssr`
- `apps/api`: `@supabase/supabase-js`
- 버전 핀 + lockfile 커밋(공급망 보안).

## 환경변수 (설정·검증 완료)

- web `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`(=https://ypoaawwuhxqudgggysef.supabase.co), `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_API_URL`(=http://localhost:4000)
- api `.env`: `SUPABASE_URL`(동일), `SUPABASE_PUBLISHABLE_KEY`, 기존 `DATABASE_URL`/`DIRECT_URL` 유지

## TDD 계획 (web=vitest, api=jest)

- **api (jest)**: `SupabaseAuthGuard` — 토큰 없음/위조 → 401, 유효 → 통과(getUser 모킹). `AuthController` — `/auth/sync` upsert가 PrismaService 호출하는지, `/auth/me`가 유저 반환/404(PrismaService·SupabaseService 모킹).
- **web (vitest)**: `/login` 페이지가 "카카오로 시작하기" 버튼 렌더, 클릭 시 `signInWithOAuth` 호출(supabase client 모킹). 홈이 로그인/비로그인 분기 렌더.
- 각 유닛: 실패 테스트 먼저 → 구현 → 통과.

## 검증 (성공 기준)

1. `pnpm dev` → `/login`에서 카카오 로그인 → 동의 후 `/`로 돌아와 닉네임 표시 (브라우저 end-to-end)
2. Supabase `auth.users`와 `public.User`에 같은 UUID row 생성 (대시보드/SQL)
3. `GET /auth/me` 토큰 없이 401, 토큰 있으면 200 (curl)
4. 로그아웃 후 `/`가 비로그인 상태로 표시
5. `pnpm --filter=@mulink/api test` / `pnpm --filter=@mulink/web test` 전부 통과

## 작업 순서 (제안)

1. 패키지 설치(확인 후) → 검증: 설치 성공, lockfile 갱신
2. RLS enable SQL → 검증: 공개 API 차단, NestJS 정상
3. api: AuthModule(guard/service/controller) TDD → 검증: jest 통과
4. web: supabase 유틸 + proxy.ts → 검증: 빌드/타입
5. web: /login + /auth/callback + 홈 수정 TDD → 검증: vitest 통과
6. end-to-end 수동 로그인 검증
