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
- AWS SDK v3 (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` — S3 presigned URL 발급)
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
- 주요 필드: `userId`(FK, unique), `activityName`(활동명, 텍스트), `region`(활동 지역, `Region` enum · 단일 값), `imageUrl`(프로필 이미지 S3 URL, **nullable** — 미등록 시 학생 화면에서 기본 아바타 표시)
- User 삭제 시 cascade.
- 이미지 파일 자체는 AWS S3에 두고, DB에는 그 공개 URL 문자열만 저장한다. 업로드 방식은 7장 참고.

**LessonRequest (레슨 신청)** — 기획: 레슨 신청 작성 / 내 레슨 신청 현황 페이지
- 학생이 올린 "레슨 받고 싶어요" 모집글.
- 주요 필드: `studentId`(FK → User, **unique**), `region`(희망 지역, `Region` enum · 단일 값), `goal`(레슨 목적, 텍스트), `genre`(선호 장르, `Genre` enum · 단일 값), `createdAt`
- **`studentId`는 unique** — 1인 1신청을 DB 제약으로 보장한다 (앱 레벨 체크만으로는 동시 요청에 뚫린다).
- User(학생) 삭제 시 cascade.

**LessonProposal (레슨 제안)** — 기획: 레슨 신청 목록 페이지 (코치) *(신규 추가 필요)*
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
| POST | `/coach-profiles/upload-url` | 프로필 이미지 업로드용 S3 presigned URL 발급 |
| POST | `/coach-profiles` | 코치 가입(전환) — 활동명·지역·(선택)이미지 URL 등록 |

> `POST /coach-profiles/upload-url`은 클라이언트가 S3에 이미지를 직접 올리기 위한 presigned PUT URL을 발급한다. body로 파일 정보(contentType 등)를 받아 서버가 IAM 권한으로 서명한 임시 URL과, 업로드 후 접근할 공개 URL을 반환한다. 원본/변환본 파일은 서버를 거치지 않고 브라우저 → S3로 직접 전송된다(서버 대역폭·부하 절감). 상세 흐름은 7장 참고.
>
> `POST /coach-profiles`는 하나의 트랜잭션으로 처리한다: ① CoachProfile 생성(활동명·지역·`imageUrl`) ② `User.role`을 COACH로 변경 ③ 그 유저의 기존 LessonRequest(및 cascade로 딸린 LessonProposal) 삭제. `imageUrl`은 앞서 발급받은 presigned URL로 S3 업로드를 마친 뒤 얻은 공개 URL이며, 미등록 시 생략 가능(nullable). 코치 프로필 조회 전용 GET은 두지 않는다 — 코치 프로필은 `GET /lesson-requests/me` 응답에 nested로 포함된다.


### 레슨 신청 — `lesson-request` 모듈

| 메서드 | 경로 | 설명 |
|:---|:---|:---|
| POST | `/lesson-requests` | 신청 생성 (학생) |
| GET | `/lesson-requests` | 모집중 신청 목록 + 내가 보낸 제안 조회 (코치) |
| GET | `/lesson-requests/me` | 내 신청 + 받은 제안 조회 (학생) |
| DELETE | `/lesson-requests/:id` | 신청 삭제 (제안 cascade) |


### 레슨 제안 — `lesson-proposal` 모듈

| 메서드 | 경로 | 설명 |
|:---|:---|:---|
| POST | `/lesson-requests/:id/lesson-proposals` | 제안 생성 (1신청 1제안) |
| DELETE | `/lesson-proposals/:id` | 제안 취소 *(미구현 — 신규 추가 필요)* |


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
        "coachProfile": { "activityName": "...", "region": "SEOUL", "imageUrl": "https://<버킷>.s3.<리전>.amazonaws.com/..." }   // CoachProfile nested, imageUrl은 미등록 시 null
      }
    ]
  }
  ```

- `GET /lesson-requests`(코치 목록)도 **화면 지향 엔드포인트**다. 레슨 신청 목록 페이지(코치)가 둘러보기·제안 보내기·제안 취소를 한 화면에서 처리하므로, 각 신청 항목에 "내가 이미 보낸 제안"을 `myProposal`로 nested 반환한다(제안 없으면 `null`). 별도로 내가 보낸 제안만 모아 조회하는 화면·엔드포인트는 없다(`GET /lesson-proposals/me`는 만들지 않음 — 코치용 "보낸 제안 목록 페이지"가 사라졌기 때문).

  응답 형태 예시:
  ```jsonc
  [
    {
      "id": "...", "region": "SEOUL", "goal": "...", "genre": "BALLAD", "createdAt": "...",
      "studentNickname": "...",
      "myProposal": null   // 아직 제안 안 보낸 신청 — 프론트는 제안 보내기 폼을 보여줌
    },
    {
      "id": "...", "region": "BUSAN", "goal": "...", "genre": "ROCK", "createdAt": "...",
      "studentNickname": "...",
      "myProposal": { "id": "...", "message": "...", "createdAt": "..." }   // 이미 보낸 제안 — 프론트는 "제안 완료" 뱃지 + 펼치면 한마디·발송 시각·취소 버튼을 보여줌
    }
  ]
  ```

  > **구현 필요**: 현재 `lesson-request.service.ts`의 `getOpenLessonRequests`는 `isProposed`(boolean)만 내려준다. 위 응답 형태(`myProposal` nested 객체)로 바꿔야 한다 — 코치가 보낸 제안 id/message/createdAt까지 함께 조회하도록 수정.
  >
  > **구현 필요**: `DELETE /lesson-proposals/:id`(제안 취소)는 표에만 있고 실제 컨트롤러/서비스 코드가 없다. `lesson-proposal.controller.ts`/`lesson-proposal.service.ts`에 추가해야 한다. 본인이 보낸 제안인지 확인(coachId 대조) 후 삭제하는 방식으로, 기존 `lesson-request.service.ts`의 `removeLessonRequest`(본인 확인 후 삭제) 패턴을 따른다.

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
| `/coach/lesson-requests` | 코치 | `(coach)` | 모집중 레슨 신청 목록 (제안 보내기/취소 포함) |

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

# AWS S3 (코치 프로필 이미지 저장 — presigned URL 발급용)
AWS_REGION                     # 예: ap-northeast-2
AWS_ACCESS_KEY_ID              # IAM 사용자 액세스 키 (S3 PutObject 권한)
AWS_SECRET_ACCESS_KEY          # IAM 사용자 시크릿 키
S3_BUCKET                      # 프로필 이미지 버킷명 (퍼블릭 읽기)

# 기타
WEB_ORIGIN                     # 로그인 후 web 리다이렉트 주소
```

---

## 7. 코치 프로필 이미지 업로드

코치 가입 시 프로필 이미지를 등록할 수 있다(선택). 이미지는 **브라우저에서 AWS S3로 직접 업로드**하고, 서버에는 그 공개 URL만 저장한다. 원본 파일이 백엔드를 거치지 않으므로 서버 대역폭·처리 부하·스토리지를 아끼는 것이 이 설계의 목적이다.

### 저장소

- **AWS S3** 버킷 하나(프로필 이미지 전용, **퍼블릭 읽기**). 이미지 파일 자체는 S3, DB(`CoachProfile.imageUrl`)에는 공개 URL 문자열만 둔다.
- 버킷 **CORS 설정 필수**: 브라우저가 presigned URL로 `PUT` 하려면 웹 오리진(로컬·Amplify 배포 도메인)에 대한 `PUT`/`GET` 허용이 있어야 한다.

### 업로드 흐름 (클라이언트 직접 업로드 + presigned URL)

| 단계 | 주체 | 동작 |
|:---:|:---|:---|
| 1 | web | 사용자가 이미지 파일 선택 → **브라우저에서 축소·변환**(긴 변 상한 리사이징 + WebP, 아래 참고) |
| 2 | web → 서버 | `POST /coach-profiles/upload-url` — 변환본의 contentType 등을 보내 presigned PUT URL 요청 |
| 3 | 서버 → web | IAM 권한으로 서명한 presigned PUT URL + 업로드 후 접근할 공개 URL 반환 |
| 4 | web → S3 | presigned URL로 변환본을 **S3에 직접 `PUT`** (백엔드 미경유) |
| 5 | web → 서버 | `POST /coach-profiles` — 활동명·지역과 함께 S3 공개 URL(`imageUrl`) 전송 → DB 저장 |

- 이미지 미등록 시 2~4단계를 건너뛰고 `imageUrl` 없이 5단계만 수행한다.
- 업로드 실패 시 코치 가입을 완료하지 않는다(PRODUCT 엣지케이스: 1차엔 이미지 수정 수단이 없어 업로드 성공을 가입 조건으로 둠).

### 브라우저 이미지 축소 (1단계 상세)

- **Canvas API**로 업로드 직전 원본을 축소한다: `drawImage`로 긴 변 기준 리사이징(비율 유지, 목록 표시와 상세 확대를 모두 커버하는 상한) → `toBlob('image/webp', quality)`로 WebP 변환.
- **HEIC**(아이폰 기본 포맷)는 브라우저 Canvas가 못 읽으므로 변환 처리, **EXIF 회전** 정보 반영, **WebP 미지원 브라우저는 JPEG 폴백**.
- 표시는 목록 아바타에서 `next/image`로 렌더한다(`next.config.ts`의 `images.remotePatterns`에 S3 도메인 등록 필요).

> 축소를 서버(sharp)가 아니라 클라이언트에서 하는 이유: 서버 변환은 원본이 이미 업로드된 뒤라 업로드 대역폭·서버 수신 부하·원본 스토리지를 줄이지 못한다. 브라우저에서 미리 줄이면 축소본만 네트워크를 타므로 이 비용들이 함께 줄어든다.
