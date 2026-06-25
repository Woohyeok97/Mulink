# 코치 회원가입 백엔드 기능 — 설계 스펙

> 이 문서는 다른 Claude 컨텍스트가 단독으로 읽고 구현할 수 있도록 작성되었다.
> brainstorming 워크플로우로 사용자와 합의한 결과물이며, 다음 단계는 writing-plans(구현 플랜) → TDD 구현이다.

---

## Context (왜 이 작업을 하는가)

MU:LINK(뮤링)은 수강생-보컬코치 매칭 플랫폼이다. 현재 카카오 로그인/회원가입은 **수강생(STUDENT)용만** 구현되어 있다. 기획서(`docs/private/뮤링_기획서.md`)상 **코치 회원가입 페이지**가 별도로 존재하며, 코치는 수강생과 **동일한 카카오 로그인**을 쓰되 **활동명·지역 등 추가 정보**를 입력해야 한다(기획서 "코치 회원가입 페이지" 섹션, 96~98번 줄).

이번 작업은 그 중 **백엔드 부분만** 다룬다: "이미 카카오 로그인한 유저가 활동명·지역을 제출하면 코치로 등록되는 API".

### 기존 인증 구조 (탐색 결과 요약)
- 인증은 Supabase가, 우리 서비스 회원정보는 `public.User` 테이블이 담당. 둘은 **같은 UUID(`User.id` = `auth.users.id`)로 1:1 연결**.
- 카카오 OAuth 흐름: `apps/api/src/auth/kakao-auth.controller.ts` → 토큰을 1회용 sessionCode로 숨겨 web으로 전달 → web `apps/web/src/app/auth/callback/route.ts`가 세션 쿠키 주입 후 `POST /users`로 `public.User` 동기화.
- `upsertUser`는 **항상 role=STUDENT로** User를 생성한다(`apps/api/src/auth/auth.service.ts:13`). 즉 코치 가입자도 폼 제출 전까지는 DB상 STUDENT.
- 보호 엔드포인트 패턴: `@UseGuards(SupabaseAuthGuard)` + `@Req() req`에서 `req.user`(Supabase User) 사용. `req.user.id`가 곧 `User.id`.
- **카카오 로그인 코드는 이번 작업에서 전혀 수정하지 않는다.** `CoachModule`을 옆에 새로 추가하는 방식.

### 유저 플로우 / UX (기획 맥락 — 백엔드 설계 근거)
- 헤더에 `[로그인/회원가입]`(학생용, 기구현)과 `[코치 가입]` 버튼이 따로 있음.
- `[코치 가입]` → 코치 가입 페이지 → 카카오 로그인(기존 재사용) → 코치 추가정보 폼 → 제출(`POST /coaches`) → 코치 완료.
- **빈틈 분석 결과 (백엔드는 "단단한 최종 방어선" 역할):**
  1. 코치 가입자도 폼 제출 전엔 STUDENT. 폼에서 이탈하면 STUDENT 계정만 남고, 재방문 시 이어서 가입 가능(`POST /coaches`가 STUDENT면 받으므로 자연 지원).
  2. 이미 코치인 사람이 또 누르면 백엔드가 409로 막음. **프론트에서 코치 폼 진입 시 role 선검사로 대시보드 리다이렉트**하는 게 UX상 권장(프론트 작업, 이번 범위 밖).
  3. 카카오 callback 도착지를 코치 폼 페이지로 분기하는 건 **프론트 작업**(이번 범위 밖). 백엔드 API는 도착지와 무관하게 동일 동작.
  4. ADMIN이 코치 가입 시도하면 정책상 거부(409).

---

## 결정 사항 (사용자와 합의)

| 항목 | 결정 |
|---|---|
| 중복가입 정책 | **STUDENT만 COACH 승격 허용. 이미 COACH거나 ADMIN이면 409 Conflict** |
| 입력 필드 | `activityName`(활동명), `region`(지역) — 둘 다 필수. 카카오ID/닉네임은 이미 User에 있으니 받지 않음 |
| region 타입 | **enum `Region { SEOUL, GYEONGGI, INCHEON }`** (자유 문자열 X). 화면 표시명(서울/경기/인천)은 프론트에서 매핑 |
| 스키마 범위 | CoachProfile = activityName + region 만. 제안 발송권(크레딧) 등 결제 관련은 **이번 범위 제외(YAGNI)** |
| 입력 검증 | **서비스에서 수동 체크** (class-validator 미설치, 기존 코드 스타일과 일관) |
| role+프로필 일관성 | **Prisma `$transaction`으로 묶음(접근법 A)** — 절반만 성공하는 깨진 계정 방지 |
| 자격 확인 위치 | **트랜잭션 밖**에서 먼저 조회·거부. 트랜잭션은 쓰기(update+create)만 |
| 트랜잭션 변수명 | `tx` 같은 모호한 이름 금지 → `prismaTransaction` |

---

## 설계

### 1. 데이터 모델 (`apps/api/prisma/schema.prisma`)

```prisma
// 코치 활동 지역
enum Region {
  SEOUL    // 서울
  GYEONGGI // 경기
  INCHEON  // 인천
}

// User 모델에 1:1 관계 필드 추가 (가상 — DB 컬럼 안 생김)
model User {
  // ...기존 필드 그대로...
  coachProfile   CoachProfile?
}

// 새 모델
model CoachProfile {
  id           String   @id @default(cuid())
  userId       String   @unique @db.Uuid                  // User와 1:1
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  activityName String                                      // 활동명
  region       Region                                      // 활동 지역(enum)
  createdAt    DateTime @default(now())
}
```
- `userId @unique` → 한 유저당 프로필 1개(1:1 보장 + 동시호출 경쟁의 최종 방어선)
- `onDelete: Cascade` → 기존 `LessonRequest` 패턴과 동일
- 스키마 변경 후 `pnpm --filter=@mulink/api exec prisma generate` 필요(CLAUDE.md 규칙). 생성 경로는 `apps/api/generated/prisma`.

### 2. API 엔드포인트

```
POST /coaches
- 가드: @UseGuards(SupabaseAuthGuard)           // 로그인 필수, 기존 가드 재사용
- body: { activityName: string, region: Region }
- 대상: 토큰 주인(req.user.id) — body로 userId 받지 않음(위조 방지, /users/me와 동일 원칙)
- 동작: STUDENT → COACH 승격 + CoachProfile 생성
- 성공 응답: 201, 생성된 CoachProfile
```

### 3. 서비스 로직 — `CoachService.registerCoach(userId, dto)`

```
1. [입력 검증]  activityName 빈값 → BadRequestException
                region이 Region enum 값 아님 → BadRequestException
2. [자격 확인]  User 조회(findUnique)  ← 트랜잭션 밖
                - 없음        → NotFoundException
                - COACH       → ConflictException
                - ADMIN       → ConflictException
                - STUDENT     → 통과
3. [트랜잭션]   prisma.$transaction(async (prismaTransaction) => {
                  await prismaTransaction.user.update({ role: COACH })
                  return prismaTransaction.coachProfile.create({ userId, activityName, region })
                })
4. [응답]       생성된 CoachProfile 반환
```

### 4. 에러 처리 (NestJS 예외 → HTTP 자동 변환, 기존 패턴 동일)

| 상황 | 예외 | 코드 | 메시지(한국어) |
|---|---|---|---|
| 활동명 빈값 | `BadRequestException` | 400 | "활동명을 입력해주세요." |
| 지역 부적합 | `BadRequestException` | 400 | "지역은 서울/경기/인천 중 선택해주세요." |
| User 없음 | `NotFoundException` | 404 | "유저를 찾을 수 없습니다." |
| 이미 COACH | `ConflictException` | 409 | "이미 코치로 등록된 계정입니다." |
| ADMIN | `ConflictException` | 409 | "코치로 등록할 수 없는 계정입니다." |
| 토큰 무효 | (가드 자동) | 401 | — |

### 5. 파일 구성 (신규 `coach` 모듈, 기존 auth 미수정)
```
apps/api/src/coach/
├── coach.module.ts        # CoachController + CoachService 등록
├── coach.controller.ts    # POST /coaches, @UseGuards(SupabaseAuthGuard)
├── coach.service.ts       # registerCoach 로직
├── coach.service.spec.ts  # 단위 테스트(아래)
└── dto/register-coach.dto.ts  # { activityName, region } 타입
```
- `app.module.ts`의 `imports`에 `CoachModule` 추가.
- `SupabaseAuthGuard`/`SupabaseService`는 `AuthModule` 소속 → CoachModule에서 쓰려면 가시성 처리 필요(예: AuthModule에서 `SupabaseAuthGuard`/`SupabaseService` export 후 CoachModule이 AuthModule import). **구현 시 확인 필요.**

### 6. 테스트 설계 (TDD — 먼저 작성 후 구현)
`coach.service.spec.ts` — prisma 목킹(기존 `auth.service.spec.ts` 스타일). prisma 목: `{ user: { findUnique }, $transaction }`. `$transaction` 목은 전달된 콜백을 `prismaTransaction` 목으로 실행시켜 update/create 호출을 검증.

| # | 케이스 | 검증 |
|---|---|---|
| 1 | STUDENT 등록 성공 | `$transaction` 호출, update(role=COACH)+create 올바른 인자, 결과 반환 |
| 2 | 활동명 빈값 | `BadRequestException`, 트랜잭션 미호출 |
| 3 | 지역 부적합 | `BadRequestException`, 트랜잭션 미호출 |
| 4 | 이미 COACH | `ConflictException`, 트랜잭션 미호출 |
| 5 | ADMIN | `ConflictException`, 트랜잭션 미호출 |
| 6 | User 없음 | `NotFoundException`, 트랜잭션 미호출 |

컨트롤러는 단순 위임이라 별도 테스트 생략(기존 `auth.controller`도 컨트롤러 테스트 없음). 필요 시 e2e로 보강.

---

## 검증 방법 (구현 후)
1. `pnpm --filter=@mulink/api exec prisma generate` 성공 + `pnpm --filter=@mulink/api test -- coach.service` 6개 케이스 통과.
2. `pnpm --filter=@mulink/api check-types`(또는 루트 `pnpm check-types`) 타입 통과.
3. (선택) dev 서버 띄워 `POST /coaches`에 유효 토큰 + `{activityName, region:"SEOUL"}` → 201 / role=COACH 확인, 재호출 시 409 확인.

## 범위 밖 (이번 작업 제외)
- 프론트: 코치 가입 페이지, 폼, callback 도착지 분기, role 선검사 리다이렉트.
- 제안 발송권/결제/구독, ADMIN 추가 테이블, `/users/me`에 coachProfile include(필요 시 별도 작업).
