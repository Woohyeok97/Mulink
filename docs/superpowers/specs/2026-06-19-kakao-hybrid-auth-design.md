# 카카오 로그인: Supabase Auth → 하이브리드 방식 전환 (설계 스펙)

## Context (왜 이 변경을 하는가)

현재 카카오 로그인은 `supabase.auth.signInWithOAuth({ provider: 'kakao' })`로 동작하는데,
카카오 동의창에서 **KOE205 "잘못된 요청"** 에러가 난다.

원인: Supabase Auth(GoTrue)는 카카오 OAuth 요청에 `account_email` scope를 하드코딩으로 강제
포함하며, 클라이언트가 넘긴 `scopes`는 덮어쓰기가 아니라 append라서 제거가 불가능하다.
`account_email`은 카카오 비즈앱(또는 사업자등록)만 설정 가능한 동의항목인데, 이 앱은 비즈앱
전환이 불가능하다. (Supabase Issue #36878, #29917의 알려진 문제)

**의도한 결과:** 카카오 인증 부분만 Supabase Auth를 거치지 않고 NestJS가 직접 구현해 scope를
완전히 통제(`profile_nickname`, `profile_image`만 요청)한다. 세션 발급·검증·갱신과 유저
저장소(`auth.users`)는 검증된 Supabase Auth를 그대로 사용한다 = **하이브리드**.

## 합의된 결정 (브레인스토밍)

| 결정 | 선택 | 근거 |
|---|---|---|
| 접근법 | **A. 하이브리드** | 문제 지점(카카오 scope)만 외과적 교체. 기존 가드/sync/me/ssr/RLS 무수정 재사용. B(완전 자체인증)는 과한 범위(YAGNI), C(OIDC)는 카카오 비호환 |
| 카카오 code 수신처 | **NestJS `/auth/kakao/callback`** | 카카오 시크릿 키가 NestJS에 있으므로, 대화 주체와 키 위치를 일치 → 흐름 직선화(web 경유 시 토스 +1) |
| 세션 토큰 전달 | **일회용 교환권(ticket)** | 토큰을 URL/로그/브라우저 히스토리에 노출하지 않음. 외부 저장소 없이 서버 메모리 Map(30초 TTL) |
| web 쿠키 주입 | **기존 `/auth/callback` 라우트에서 setSession** | 기존 `@supabase/ssr` 쿠키 구조 유지. SSR/`/auth/me`/getNickname 무수정. 새 라우트 안 만들고 기존 callback을 ticket 받도록 교체(파일 수·데드코드 방지) |
| 신규 유저 생성 | **generateLink(magiclink) 자동생성** | magiclink는 해당 이메일 유저 없으면 자동 생성(멱등). createUser 생략 → 코드 단순화 |
| 합성 이메일 | **`{kakaoId}@kakao.local`** | 카카오 미제공 이메일 대체 식별자. `.local`은 실존 안 하는 TLD라 실수 발송 방지 |
| 로그아웃 | **기존 signOut 그대로** | 세션은 여전히 Supabase 관리. 변경 불필요 |

## SDK 사실 검증 (설치된 `@supabase/auth-js@2.108.2` 타입 직접 확인)

- `generateLink({ type: 'magiclink', email })` 응답: `data.properties.hashed_token` (← `token_hash` 아님)
- `verifyOtp({ token_hash, type: 'email' })` — 파라미터명은 `token_hash` (응답 필드명과 다름. 혼동 주의).
  ⚠️ `generateLink`가 `magiclink`여도, `token_hash`로 검증할 때 `type`은 **`'email'`**이다.
  타입 정의상 `'magiclink'`도 허용되지만 런타임에서는 매칭되는 토큰을 못 찾아 `otp_expired`로 거부된다.
- `verifyOtp` 성공 시 `data.session`에 `access_token` / `refresh_token` 반환
- magiclink generateLink는 유저가 없으면 자동 생성 (타입 주석: "handles the creation of the user for signup, invite and magiclink")
- `@supabase/ssr@0.12.0` `createBrowserClient`는 쿠키 저장소(`cookieEncoding: base64url`) 사용 → setSession이 쿠키에 씀

## 아키텍처 — 전체 로그인 흐름

```
[web]                         [NestJS]                  [카카오]    [Supabase]
 1. 로그인 클릭 → GET /auth/kakao/login
                              2. state 발급(쿠키 저장 + 인가URL에 포함)
                                 카카오 인가URL 생성
 ← redirect 카카오 (scope=profile_nickname profile_image)
 3. 동의 → 카카오가 code+state로 /auth/kakao/callback redirect
                              4. state 검증 (쿠키 대조, CSRF)
                              5. code → 카카오 토큰교환(kauth.kakao.com/oauth/token)
                              6. 카카오 유저정보(kapi.kakao.com/v2/user/me) → kakaoId, nickname
                              7. generateLink(magiclink, {kakaoId}@kakao.local,
                                   user_metadata:{provider:'kakao', provider_id, name})  → auth.users 자동생성
                                                                              → hashed_token
                              8. verifyOtp(token_hash=hashed_token, type:email)
                                                                              → access/refresh 토큰
                              9. 교환권(ticket) 발급, 토큰을 메모리에 30초 보관
 ← redirect /auth/callback?ticket=xxx
 10. POST {API}/auth/session/exchange {ticket} → access/refresh 토큰
 11. createServerClient.setSession(토큰) → 쿠키 기록
 12. POST {API}/auth/sync (Bearer) → public.User upsert  (기존 로직 재사용)
 13. redirect /
```

## 컴포넌트 (파일 단위, 단일 책임)

### 신규 — NestJS (`apps/api/src/auth/`)

- **`kakao-oauth.service.ts`** — 카카오 OAuth 통신 전담
  - `buildAuthorizeUrl(state)`: 인가 URL 생성 (scope 직접 지정)
  - `exchangeCodeForToken(code)`: code → 카카오 access_token
  - `fetchUserInfo(kakaoAccessToken)`: `/v2/user/me` → `{ kakaoId, nickname }`
  - 의존: `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET`, `KAKAO_REDIRECT_URI` (env)

- **`supabase-admin.service.ts`** — service_role 클라이언트(세션 발급 전담), 검증용 `SupabaseService`와 **분리**
  - `issueSession({ kakaoId, nickname })`: 합성 이메일로 `generateLink(magiclink)` → `hashed_token`
    → `verifyOtp({ token_hash })` → `{ access_token, refresh_token }` 반환
  - 의존: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (**서버 전용. NEXT_PUBLIC_ 금지**)

- **`session-ticket.service.ts`** — 일회용 교환권 저장소
  - `issue(tokens)`: 랜덤 ticket 발급, `Map<ticket, {tokens, expiresAt}>`에 저장(TTL 30초)
  - `consume(ticket)`: 1회 조회 후 즉시 삭제. 만료/없음이면 null

- **`kakao-auth.controller.ts`** — 카카오 인증 라우트 (기존 `AuthController`와 별도, **가드 미적용**: 로그인 전이라 토큰 없음)
  - `GET /auth/kakao/login`: state 발급 → 카카오 인가URL로 302
  - `GET /auth/kakao/callback`: state 검증 → 카카오 토큰교환 → 유저정보 → issueSession → ticket 발급 → web `/auth/callback?ticket=` 로 302
  - `POST /auth/session/exchange`: `{ ticket }` → 토큰 반환 (가드 미적용)

- **`auth.module.ts`** (수정): 위 서비스/컨트롤러 등록

### 수정 — NestJS (기존, 최소 변경)

- **`kakao-profile.ts`**: 현재 Supabase User 객체에서 추출. 전환 후 카카오 유저정보를 NestJS가
  `generateLink`의 `user_metadata`에 `{ provider:'kakao', provider_id:kakaoId, name:nickname }`로
  넣으면, `verifyOtp`로 만들어진 Supabase User에 이 메타가 실려 **기존 `extractKakaoProfile`이 그대로 동작**.
  → 별도 수정 불필요(메타 키를 기존 추출 로직과 맞추기만 하면 됨). 검증 후 필요 시 폴백 키 보강.

### 수정 — web (`apps/web/src/`)

- **`app/login/page.tsx`**: `signInWithOAuth` 호출 제거 → `GET {API}/auth/kakao/login`으로 이동
  (서버가 카카오로 redirect). 버튼 클릭 시 `window.location.href = ${API}/auth/kakao/login`
- **`app/auth/callback/route.ts`** (수정, 재사용): 받는 파라미터를 `code` → `ticket`으로 교체.
  `ticket`으로 `/auth/session/exchange` 토큰 교환 → `createServerClient.setSession()` →
  기존 `/auth/sync` 호출(Bearer) → `/`로 redirect. 기존 sync/redirect 패턴은 그대로 유지.
  (`exchangeCodeForSession` 호출만 ticket 교환 + setSession으로 교체)
- `home-auth.tsx`, `actions/auth.ts`(signOut): **변경 없음**

### 무수정 (재사용)

`supabase-auth.guard.ts`, `auth.service.ts`(sync/me), `AuthController`(/sync /me),
`supabase.service.ts`(검증용 getUser), ssr `client.ts`/`server.ts`/`proxy-session.ts`, RLS

## 데이터 흐름 핵심 포인트

- **두 Supabase 클라이언트 분리**: 검증용(publishable key, 기존 `SupabaseService`) vs 발급용
  (service_role key, 신규 `SupabaseAdminService`). 권한이 달라 반드시 분리.
- **메타데이터 매핑**: 카카오 `/v2/user/me` 응답 → `generateLink`의 `user_metadata` → verifyOtp가 만든
  User에 실림 → 기존 `extractKakaoProfile`이 읽음 → `/auth/sync`가 `public.User` upsert.
  ⚠️ `user_metadata`는 인가 판단에 절대 사용 금지(표시/최초저장 용도만). 역할 권한은 Prisma `User.role`에서.
- **멱등성**: 합성 이메일이 unique 식별자. 재로그인 시 같은 이메일 → generateLink가 기존 유저 재사용
  → 같은 `auth.users.id` → 같은 `public.User`.

## CSRF 보호 (state)

`signInWithOAuth`가 자동으로 해주던 state 검증을 NestJS가 직접 구현한다.

- `GET /auth/kakao/login`: 랜덤 state 생성 → **HttpOnly·SameSite=Lax·단기 만료 쿠키**에 저장,
  동시에 카카오 인가URL의 `state` 파라미터에 포함.
- `GET /auth/kakao/callback`: 카카오가 돌려준 `state` 쿼리와 **쿠키의 state를 대조**. 불일치/없음/만료면
  거부(`/login?error=state`). 대조 후 쿠키는 즉시 삭제(1회용).

## 에러 처리

| 지점 | 실패 | 처리 |
|---|---|---|
| state 검증 | 불일치/없음 | `/login?error=state`로 redirect (CSRF 차단) |
| 카카오 토큰교환 | code 만료/오류 | `/login?error=kakao`로 redirect |
| 카카오 유저정보 | nickname 없음 | 폴백 `'카카오사용자'`(기존 로직과 동일) |
| generateLink/verifyOtp | 실패 | 500 로깅 후 `/login?error=session` |
| ticket 교환 | 만료/없음/재사용 | 401 → web은 `/login?error=expired` |
| /auth/sync | 실패 | 기존과 동일하게 `/login?error=sync` |

## 테스트 (검증 가능한 목표)

- **단위 (Jest, apps/api)**:
  - `session-ticket.service.spec`: 발급→소비 1회성, 만료, 재사용 시 null
  - `kakao-oauth.service.spec`: fetch mock으로 토큰교환/유저정보 파싱 (kakaoId/nickname 추출)
  - `supabase-admin.service.spec`: generateLink→verifyOtp mock, `hashed_token`→`token_hash` 매핑이
    올바른지 (오타 시 undefined로 조용히 실패하는 함정 회귀 방지)
  - state 발급/검증 로직 단위 테스트
- **수동 E2E** (검증 흐름):
  1. 인프라 설정(아래) 완료 후 `pnpm dev`
  2. /login → "카카오로 시작하기" → 동의창에 **account_email 없이** profile만 표시되는지 확인 (KOE205 미발생)
  3. 동의 → `/`로 돌아와 "환영합니다 {닉네임}님" 표시 (sync 성공)
  4. 새로고침해도 로그인 유지(쿠키 세션) → `/auth/me` 200
  5. 로그아웃 → 다시 로그인 시 같은 유저(같은 public.User row, kakaoId 동일)
  6. ticket 직접 재호출 시 401 확인

## 인프라/콘솔 설정 (코드 아님, 구현 전/후 별도 처리)

- **카카오 디벨로퍼스**: Redirect URI를 Supabase 콜백 → `{API}/auth/kakao/callback`으로 변경.
  동의항목에서 account_email 제거, profile_nickname/profile_image만.
- **Supabase 대시보드**: Kakao Provider disable 권장(실수로 signInWithOAuth('kakao') 재호출 시 KOE205 재발 방지).
- **신규 환경변수 (apps/api/.env, 서버 전용)**:
  `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET`, `KAKAO_REDIRECT_URI`, `SUPABASE_SERVICE_ROLE_KEY`
  ⚠️ `SUPABASE_SERVICE_ROLE_KEY`는 절대 web 번들/`NEXT_PUBLIC_`에 넣지 않는다.

## 범위 밖 (이번에 안 함)

- 완전 자체 JWT 인증(접근법 B)
- 합성 이메일 → 실제 이메일 마이그레이션
- 카카오 외 다른 소셜 로그인
- ticket 저장소를 Redis 등 외부로 (단일 인스턴스 메모리로 충분)
