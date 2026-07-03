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

### 엔티티 4개

**User (유저)** — 기획: 카카오 로그인 / 온보딩
- 카카오로 가입한 모든 사용자. `role`(STUDENT / COACH / ADMIN)로 역할 구분.
- PK는 Supabase Auth의 `auth.users.id`(UUID)와 동일하게 채운다 (자동생성 X).
- 주요 필드: `kakaoId`(unique), `nickname`, `role`(기본 STUDENT), `createdAt`

**CoachProfile (코치 프로필)** — 기획: 코치 가입 페이지
- User와 1:1. 코치로 전환한 유저만 가진다.
- 주요 필드: `userId`(FK, unique), `activityName`(활동명, 텍스트), `region`(활동 지역, `Region` enum · 단일 값)
- User 삭제 시 cascade.

**LessonRequest (레슨 신청)** — 기획: 레슨 신청 작성 / 내 레슨 신청 현황 페이지
- 학생이 올린 "레슨 받고 싶어요" 모집글.
- 주요 필드: `studentId`(FK → User, **unique**), `region`(희망 지역, `Region` enum · 단일 값), `goal`(레슨 목적, 텍스트), `genre`(선호 장르, `Genre` enum · 단일 값), `createdAt`
- **`studentId`는 unique** — 1인 1신청을 DB 제약으로 보장한다 (앱 레벨 체크만으로는 동시 요청에 뚫린다).
- User(학생) 삭제 시 cascade.

**LessonProposal (레슨 제안)** — 기획: 제안 보내기 / 보낸 제안 목록 페이지 *(신규 추가 필요)*
- 코치가 특정 레슨 신청에 보낸 제안.
- 주요 필드: `requestId`(FK → LessonRequest), `coachId`(FK → User), `message`(제안 한마디, 텍스트), `createdAt`
- **`@@unique([requestId, coachId])`** — 1레슨 신청 1레슨 제안 규칙 (같은 코치가 같은 신청에 중복 제안 불가)
- LessonRequest 삭제 시 cascade (기획: 신청 삭제 시 제안 함께 삭제)
- 코치 프로필(활동명·지역)은 제안에 담지 않는다. `coachId`로 User→CoachProfile을 조회해 붙인다. (조회는 `GET /lesson-requests/me` 응답에 nested로 녹인다 — 4장 참고)

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
| POST | `/coach-profiles` | 코치 가입(전환) — 활동명·지역 등록 |

> `POST /coach-profiles`는 하나의 트랜잭션으로 처리한다: ① CoachProfile 생성 ② `User.role`을 COACH로 변경 ③ 그 유저의 기존 LessonRequest(및 cascade로 딸린 LessonProposal) 삭제. 코치 프로필 조회 전용 GET은 두지 않는다 — 코치 프로필은 `GET /lesson-requests/me` 응답에 nested로 포함된다.


### 레슨 신청 — `lesson-request` 모듈

| 메서드 | 경로 | 설명 |
|:---|:---|:---|
| POST | `/lesson-requests` | 신청 생성 (학생) |
| GET | `/lesson-requests` | 모집중 신청 목록 (코치) |
| GET | `/lesson-requests/me` | 내 신청 + 받은 제안 조회 (학생) |
| DELETE | `/lesson-requests/:id` | 신청 삭제 (제안 cascade) |


### 레슨 제안 — `lesson-proposal` 모듈

| 메서드 | 경로 | 설명 |
|:---|:---|:---|
| POST | `/lesson-requests/:id/lesson-proposals` | 제안 생성 (1신청 1제안) |
| GET | `/lesson-proposals/me` | 내가 보낸 제안 목록 (코치) |
| DELETE | `/lesson-proposals/:id` | 제안 취소 |


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
        "coach": { "activityName": "...", "region": "SEOUL" }   // CoachProfile nested
      }
    ]
  }
  ```

### 모듈 재구조화 (해야 할 일)

현재 `auth` 폴더에 유저 리소스(`@Controller('users')`)가 섞여 있다. 이를 분리한다.

- `auth` 모듈: 인증 "과정"만 유지 (kakao-auth, session 컨트롤러 + 관련 서비스, `SupabaseAuthGuard`, `SupabaseService`)
- `user` 모듈 신설: 유저 리소스(`POST /users`, `GET /users/me`)를 옮긴다. 기존 `auth.service`의 `upsertUser`/`getMe` 로직도 `user.service`로 이동.

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
| `/coach/lesson-requests` | 코치 | `(coach)` | 모집중 레슨 신청 목록 |
| `/coach/lesson-proposals` | 코치 | `(coach)` | 내가 보낸 레슨 제안 목록 |

### 규칙

- **URL은 기능/리소스 기준, 역할은 접근 권한(가드)으로 처리.** 역할 그룹은 Route Group으로 묶어 그룹별 `layout.tsx`에 권한 가드·네비게이션을 둔다.
- **`/coach-register`는 역할 그룹에 넣지 않는다.** "아직 학생인 사람이 코치가 되는" 페이지라 `(coach)` 그룹에 두면 코치 가드에 스스로 막히고, `(student)`에 두면 전환 후 접근이 애매하다. 그룹 없는 독립 라우트로 두고, 페이지 자체에서 "로그인됨 + 아직 학생"만 확인한다.
- 단수/복수로 "내 하나" vs "여러 목록"을 구분: `/student/lesson-request`(1인 1신청, 단수) vs `/coach/lesson-requests`(목록, 복수).
- 페이지 URL ≠ API URL (기준이 다름: 페이지는 사용자 여정, API는 데이터 자원).
- 확장 시 기존 URL을 갈아엎지 않고 해당 역할 그룹에 새 페이지를 추가한다.

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

# 기타
WEB_ORIGIN                     # 로그인 후 web 리다이렉트 주소
```
