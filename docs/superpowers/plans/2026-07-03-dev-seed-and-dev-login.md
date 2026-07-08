# 개발용 시드 데이터 + dev 로그인 플랜

> ⚠️ **개발 전용 기능.** 프로덕션 전 제거 대상. 걷어내는 방법은 문서 맨 아래 "제거 방법(rollback)" 참고.

## Context (왜 이걸 하나)

MU:LINK은 카카오 OAuth로만 로그인한다. 개발자는 카톡 계정이 1개라서 유저를 여러 명 만들 수 없다.
그래서 "다른 코치가 내 신청에 제안을 보냈다", "유저가 많아졌을 때의 목록 UI" 같은 **여러 유저 간 상호작용 화면**을 개발 서버에서 눈으로 볼 수가 없다.

이걸 두 도구로 해결한다:

- **시드**: DB에 가짜 코치·학생·신청·제안을 심는다 → 화면에 데이터가 뜬다.
- **dev 로그인**: 카톡을 건너뛰고 그 가짜 유저로 로그인한다 → 브라우저에서 계정을 스위치하며 각 유저 시점 화면을 본다.

> ⚠️ Supabase 프로젝트가 1개(프로덕션 공유)뿐이라, 가짜 유저가 진짜 DB에 섞인다. 그래서 (1) dev 로그인은 프로덕션에서 잠그고, (2) 가짜 유저는 표식을 박아 언제든 지울 수 있게 한다.

---

## 큰 그림: 왜 이 방법이 우아한가 (초보용 흐름 설명)

기존 진짜 로그인 흐름을 코드에서 확인한 결과, **핵심 로직이 카톡과 이미 분리돼 있다.**

1. `SupabaseAdminService.createSessionTokens(profile)` — `{ kakaoId, nickname }`만 받으면 세션 토큰을 발급한다. 카톡과 무관.
   (`apps/api/src/auth/supabase-admin.service.ts:31`)
2. `SessionCodeService.createSessionCode(tokens)` — 토큰을 1회용 코드로 감싼다.
   (`apps/api/src/auth/session-code.service.ts:19`)
3. 프론트 `/auth/callback?code=...` — 코드를 받아 exchange → 쿠키에 세션 심기 → `POST /users`로 유저 동기화. **이미 완성돼 있다.**
   (`apps/web/src/app/(public)/auth/callback/route.ts`)

즉 **dev 로그인은 "카톡 단계만 빼고 2번부터 시작"하면 된다.** 세션코드를 발급해서 기존 `/auth/callback`으로 보내면 **프론트 콜백/세션 로직을 한 줄도 안 건드린다.**

```
[진짜 로그인]  카톡 → createSessionTokens → sessionCode → /auth/callback → 로그인 완료
[dev 로그인]   (카톡 스킵) → createSessionTokens → sessionCode → /auth/callback → 로그인 완료
                            └── 같은 함수 재사용 ──┘        └─ 같은 콜백 재사용 ─┘
```

---

## 작업 1: 시드 스크립트 (`apps/api/prisma/seed.ts` 신규)

가짜 유저는 **두 군데**에 만들어야 온전하다 (SPEC 2장: PK를 auth.users.id와 동일하게):
- `auth.users` (Supabase) — 로그인/세션 발급의 대상
- `public.User` (+ 코치면 `CoachProfile`) — 우리 도메인 데이터

### 표식 규칙 (청소를 위해)

가짜 유저의 `kakaoId`를 `dev-seed-<이름>` 형식으로 박는다. 나중에 `kakaoId LIKE 'dev-seed-%'`로 골라 지운다.
`auth.users` 쪽 합성 이메일은 기존 규칙(`{kakaoId}@kakao.local`)을 그대로 따르므로 `dev-seed-*@kakao.local`이 되어 역시 골라낼 수 있다.

### seed.ts가 하는 일 (위→아래 순서)

```
0단계: 청소 — 기존 dev-seed 유저 전부 삭제 (아래 "청소" 참고). 매 실행마다 깨끗한 상태로 리셋.
1단계: 가짜 코치 12명 생성
        - Supabase admin의 createUser로 auth.users에 생성 → 반환된 id 확보
          (이메일 dev-seed-coach1@kakao.local, user_metadata에 provider_id/name)
        - 그 id로 public.User(role=COACH) + CoachProfile(activityName, region) 생성
2단계: 가짜 학생 12명 생성 (같은 방식, role=STUDENT, CoachProfile 없음)
3단계: 가짜 학생들의 LessonRequest 생성 (studentId unique 주의 — 학생당 1개, 신청 12개)
4단계: 코치들이 가짜 학생 신청에 LessonProposal 꽂기
        - 내 진짜 계정은 건드리지 않는다 (가짜 학생 신청에만)
        - **각 학생 신청마다 정확히 6명의 코치가 제안** → 학생이 자기 화면 보면 코치 제안 6개
        - @@unique([requestId, coachId]) 주의 — 한 코치가 같은 신청에 1번만 (6명은 서로 다른 코치)
        - 어느 6명인지는 신청마다 섞어서 (코치 12명 중 골라 배정) — 코치별 "보낸 제안 목록"도 채워지도록
```

### 결정 사항 (반영됨)

- **규모: 코치 12명 + 학생 12명.** 학생 12명 → 신청 12개, 각 신청마다 코치 6명이 제안(신청당 제안 6개).
- **내 진짜 계정은 안 건드린다.** 가짜 학생에게만 신청·제안을 깐다 → 시드에 내 userId 불필요.
- 내 학생 화면(제안 받은 화면)은 **dev 로그인으로 가짜 학생이 되어** 확인한다.

### 재사용할 것 / 주의점

- **auth.users 생성은 `createSessionTokens`의 generateLink 방식이 아니라 `admin.createUser`를 쓴다** — 세션 발급이 아니라 유저를 미리 만들어두는 것이므로. id를 반환받아 `public.User.id`에 그대로 넣는다.
- Prisma 접근은 `PrismaService`가 아니라 seed용으로 `PrismaClient`를 직접 만들어 쓴다 (seed는 Nest 밖 독립 스크립트). 클라이언트 경로는 `generated/prisma` (schema.prisma:8).
- enum 값은 schema.prisma의 Region(SEOUL 등)·Genre(POP 등) 사용.

### 청소 로직 (seed.ts 0단계에서 재사용, 별도 스크립트로도 뺄 수 있음)

```
1. public.User 에서 kakaoId LIKE 'dev-seed-%' 삭제
   → cascade로 CoachProfile / LessonRequest / LessonProposal 자동 삭제 (schema의 onDelete: Cascade)
2. auth.users 에서 email LIKE 'dev-seed-%@kakao.local' 인 유저를 admin.listUsers + admin.deleteUser로 삭제
```

### 실행 설정 (실제 구현)

⚠️ Prisma 7은 `package.json`의 `prisma.seed`가 아니라 **`prisma.config.ts`의 `migrations.seed`**를 쓴다.
또한 generated Prisma client이 `./internal/class.js` 같은 `.js` 확장자 상대 import를 써서 **ts-node로는 못 돌린다**.
그래서 앱과 동일하게 **tsc로 컴파일(dist) 후 node로 실행**한다.

- `apps/api/prisma/tsconfig.seed.json` (신규): seed.ts를 `dist/prisma/seed.js`로 컴파일하는 전용 설정 (CommonJS + `resolvePackageJsonExports: false`).
- `apps/api/package.json` scripts에 `"db:seed": "tsc --project prisma/tsconfig.seed.json && node dist/prisma/seed.js"`.
- `apps/api/prisma.config.ts`의 `migrations.seed: 'pnpm db:seed'` (env는 config가 `import 'dotenv/config'`로 로드).

실행: `pnpm --filter=@mulink/api exec prisma db seed` (또는 `pnpm --filter=@mulink/api db:seed`)

---

## 작업 2: dev 로그인 백엔드 (`apps/api/src/auth/`)

### 새 엔드포인트: `GET /auth/dev/login?userId=<uuid>`

`auth` 모듈에 dev 전용 컨트롤러를 추가한다 (예: `dev-login.controller.ts`).

동작:
```
1. NODE_ENV !== 'development' 이면 404/403으로 막는다 (⚠️ 필수 — 프로덕션 보안)
2. userId로 public.User 조회 → kakaoId, nickname 확보
3. createSessionTokens({ kakaoId, nickname }) 호출 → 세션 토큰   ← 기존 서비스 재사용
4. createSessionCode(tokens)로 1회용 코드 발급                    ← 기존 서비스 재사용
5. WEB_ORIGIN/auth/callback?code=<code> 로 redirect              ← 기존 콜백 재사용
```

- `KakaoAuthController`가 admin/sessionCode를 주입받는 패턴을 그대로 복사한다 (kakao-auth.controller.ts:18-22).
- 프론트 콜백·세션·유저동기화 로직은 **손대지 않는다.** 세션코드만 같은 통로로 흘려보내면 끝.

### 보조 엔드포인트(선택): `GET /auth/dev/users`

로그인 페이지 드롭다운을 채우려면 "선택 가능한 가짜 유저 목록"이 필요하다.
`public.User`에서 `kakaoId LIKE 'dev-seed-%'`인 유저의 `{ id, nickname, role }`을 반환. 역시 NODE_ENV 가드.

---

## 작업 3: dev 로그인 프론트 패널 (`apps/web` 로그인 페이지) — 실제 구현

제거를 쉽게 하려고 **별도 컴포넌트로 분리**했다:
`apps/web/src/app/(public)/login/DevLoginPanel.tsx` (login 폴더에 co-locate).

- `'use client'` 컴포넌트. `GET /auth/dev/users`로 유저 목록을 받아 **shadcn Select**로 나열, **shadcn Button** 클릭 시 `window.location.href = ${API_URL}/auth/dev/login?userId=${선택id}`.
  → 백엔드가 세션코드 발급 → `/auth/callback`으로 redirect → 기존 로그인 완료 흐름.
- `login/page.tsx`는 **딱 두 줄만 추가**: import + `{process.env.NODE_ENV === 'development' && <DevLoginPanel />}` (카카오 버튼 아래).
- **이중 잠금**: 프론트의 `NODE_ENV` 조건은 화면 정리용이고, 진짜 방어는 백엔드 `assertDevEnv()` 가드다. 둘 다 있어야 안전.

---

## 반드시 확인할 것 (구현 전)

1. **NODE_ENV가 개발 서버에서 실제로 'development'인지** — `nest start --watch`(dev 스크립트) 기준 확인. 아니면 별도 `DEV_LOGIN=1` 같은 플래그로 가드.

---

## 검증 (Verification) — ✅ 완료된 것 표시

- [x] `pnpm --filter=@mulink/api exec prisma db seed` → 코치12·학생12·신청12·제안72(신청당6) 생성, 에러 없음.
- [x] 재실행 안전성: `db seed` 재실행 → 0단계 청소가 먼저 돌아 중복 에러 없이 리셋됨.
- [x] `GET /auth/dev/users` (NODE_ENV=development) → 24명(코치12+학생12) `{id,nickname,role}` 반환.
- [x] `GET /auth/dev/login?userId=<코치>` → **302 redirect `/auth/callback?code=<세션코드>`** (기존 로그인 흐름 연결).
- [x] 없는 userId → 404.
- [x] **프로덕션 가드**: `NODE_ENV=production`에서 두 엔드포인트 모두 404.

브라우저에서 최종 눈 확인(수동, 개발 서버 필요):
- [ ] `/login` dev 패널의 Select에 유저가 뜨고, 선택 후 로그인 버튼 → 로그인됨.
- [ ] 가짜 코치로 로그인 → `/coach/lesson-requests`에 학생 신청 12개.
- [ ] 제안 받은 가짜 학생으로 로그인 → `/student/lesson-request`에 코치 제안 6개 (**원래 목표**).

---

## 제거 방법 (rollback) — 프로덕션 배포 전 반드시

이 기능은 개발 전용이므로 걷어낼 때 아래를 지운다:

1. **DB의 가짜 데이터**: seed의 청소 로직(`kakaoId LIKE 'dev-seed-%'` User 삭제 → cascade + `auth.users`의 `dev-seed-*@kakao.local` 삭제)을 한 번 돌린다.
2. **백엔드 코드**:
   - `apps/api/prisma/seed.ts` 삭제
   - `apps/api/prisma/tsconfig.seed.json` 삭제
   - `apps/api/package.json`의 `"db:seed"` 스크립트 제거
   - `apps/api/prisma.config.ts`의 `migrations.seed` 줄 제거
   - `apps/api/src/auth/dev-login.controller.ts` 삭제 + `auth.module.ts`의 import·controllers 등록 제거
3. **프론트 코드**:
   - `apps/web/src/app/(public)/login/DevLoginPanel.tsx` 삭제
   - `login/page.tsx`의 import 줄 + `{... && <DevLoginPanel />}` 줄 제거 (딱 두 줄)
4. 기존 인증/유저 코드는 재사용만 했고 수정하지 않았으므로 건드릴 것 없음. 위 파일들이 이 기능의 전부다.
