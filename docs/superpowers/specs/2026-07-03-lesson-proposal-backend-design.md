# 레슨 제안 백엔드 API 3종 (학생 제안조회 + 코치 제안생성)

## Context

학생의 "내 레슨 신청 현황" 화면([MyLessonRequestView.tsx](apps/web/src/features/lesson-request/ui/MyLessonRequestView.tsx))에 코치가 보낸 제안 목록을 띄우고 싶은데, 현재 백엔드가 제안을 안 내려줘서 [page.tsx](<apps/web/src/app/(student)/student/lesson-request/page.tsx>)가 `proposals={[]}`로 하드코딩돼 있다. 제안이 실제로 쌓이려면 코치가 신청을 둘러보고 제안을 보낼 수 있어야 한다.

이번 작업은 그 최소 end-to-end 세트인 백엔드 API 3종을 만든다. **레슨 제안 취소 / 내가 보낸 제안 목록(`GET /lesson-proposals/me`, `DELETE /lesson-proposals/:id`)은 다음 작업으로 미룬다.**

**스키마 변경 없음** — `LessonProposal` 모델은 이미 [schema.prisma](apps/api/prisma/schema.prisma)에 `@@unique([requestId, coachId])`까지 포함해 완성돼 있다. `prisma generate`/`migrate` 불필요.

작업 규칙: 루트 CLAUDE.md 주석 스타일(단계 주석, 분기 위 경우 설명, 나열 함수 정체 주석) 준수. 코드는 ponytail(최소 구현). role 접근 제어는 서비스 레벨에서 `user.role` 조회 후 체크 — 기존 [coach-profile.service.ts](apps/api/src/coach-profile/coach-profile.service.ts) 패턴 그대로 (새 Guard 안 만듦).

## 확정 사항 (brainstorming 결과)

- role 체크: **서비스 레벨** (coach-profile.service 패턴). 새 RolesGuard 안 만듦.
- 코치 목록의 "제안 완료" 플래그 이름: **`isProposed`** (DB 컬럼 아님, 조회 시 계산되는 파생값).
- 제안 객체 안 코치 프로필 키 이름: **`coachProfile`** (`{ activityName, region }`). SPEC 4장 예시 JSON과 프론트 타입은 원래 `coach`라 어긋나므로, SPEC.md 예시도 이번에 `coachProfile`로 같이 수정. (프론트 타입 `LessonOffer` 수정은 이번 범위 밖 — 다음 작업)
- `message` 검증: 빈 값(공백만) → `BadRequestException`, 통과 시 `.trim()` 저장. 길이 제한 없음.

## 작업 내용

### 1. `GET /lesson-requests/me` 수정 (기존 서비스 수정)

**파일:** [lesson-request.service.ts](apps/api/src/lesson-request/lesson-request.service.ts) `getMyLessonRequest`

현재 `findFirst`만 → `include`로 제안 nested 추가 후 평탄화. Prisma raw는 `coach.coachProfile.activityName`으로 한 겹 더 깊으므로 서비스에서 map으로 벗겨 `coachProfile: { activityName, region }` 형태로 맞춘다.

```ts
// 1단계: 내 신청 + 제안(최신순) + 각 제안 코치의 프로필을 한 번에 조회
const request = await this.prisma.lessonRequest.findFirst({
  where: { studentId: userId },
  include: {
    proposals: {
      orderBy: { createdAt: 'desc' }, // 최신순 (기획)
      select: {
        id: true, message: true, createdAt: true,
        coach: { select: { coachProfile: { select: { activityName: true, region: true } } } },
      },
    },
  },
});
if (!request) return null;

// 2단계: coach.coachProfile 한 겹을 벗겨 응답 형태를 평탄화 (내부 테이블 구조 은닉)
return {
  ...request,
  proposals: request.proposals.map((p) => ({
    id: p.id, message: p.message, createdAt: p.createdAt,
    coachProfile: p.coach.coachProfile, // { activityName, region }
  })),
};
```

컨트롤러/라우트 그대로. 응답 형태 SPEC 4장과 일치(키만 `coachProfile`).

### 2. `GET /lesson-requests` 신설 (코치용 모집 목록)

**파일:** [lesson-request.controller.ts](apps/api/src/lesson-request/lesson-request.controller.ts) `@Get()` 추가 + [lesson-request.service.ts](apps/api/src/lesson-request/lesson-request.service.ts) `getOpenLessonRequests(userId)` 추가.

```ts
// 서비스 흐름
// 1단계: 코치인지 확인 — 학생이면 ForbiddenException (coach-profile.service 패턴)
// 2단계: 모집중 신청 전체 조회 (최신순)
// 3단계: 이 코치가 이미 제안한 requestId 집합 조회 (lessonProposal.findMany where coachId, select requestId)
// 4단계: 각 신청에 isProposed(Set.has) 붙여 반환
```

응답: `[{ id, region, goal, genre, createdAt, isProposed }]`

### 3. `POST /lesson-requests/:id/lesson-proposals` 신설 (`lesson-proposal` 모듈 신설)

**신규 파일 4개** (coach-profile 모듈 구조 복제):
- `apps/api/src/lesson-proposal/lesson-proposal.module.ts`
- `apps/api/src/lesson-proposal/lesson-proposal.controller.ts` — `@Controller('lesson-requests/:id/lesson-proposals')`, `@Post()`, `@UseGuards(SupabaseAuthGuard)`
- `apps/api/src/lesson-proposal/lesson-proposal.service.ts`
- `apps/api/src/lesson-proposal/dto/create-lesson-proposal.dto.ts` — `{ message: string }`

```ts
// createProposal 서비스 흐름
// 1단계: message 빈 값(공백만)이면 BadRequestException
// 2단계: 코치인지 확인 — 학생이면 ForbiddenException
// 3단계: 대상 신청 존재 확인 — 없으면 NotFoundException (기획: 삭제된 신청에 제안 방어)
// 4단계: 제안 생성. @@unique([requestId, coachId]) 위반(P2002) → ConflictException (이미 제안함)
```

중복 제안은 DB unique 제약에 의존(동시요청 방어 — SPEC 원칙). Prisma `P2002` catch → `ConflictException` 변환.

**등록:** `LessonProposalModule`을 [app.module.ts](apps/api/src/app.module.ts) `imports`에 추가.

### 4. SPEC.md 예시 수정

[docs/SPEC.md](docs/SPEC.md) 4장 `GET /lesson-requests/me` 응답 예시의 `"coach": {...}` → `"coachProfile": {...}`로 한 줄 수정.

### 5. 테스트

기존 [lesson-request.service.spec.ts](apps/api/src/lesson-request/lesson-request.service.spec.ts) 패턴(prisma mock)으로:
- `lesson-request.service.spec.ts`에 케이스 추가: `getMyLessonRequest` 제안 nested·평탄화, `getOpenLessonRequests` isProposed 매핑 + 학생 접근 차단.
- `lesson-proposal.service.spec.ts` 신설: 빈 message 거부, 학생 접근 차단, 삭제된 신청 방어, 중복 제안(P2002) → Conflict.

## 검증

```sh
# 타입체크 + 유닛테스트 (apps/api)
pnpm --filter=@mulink/api test -- lesson-request
pnpm --filter=@mulink/api test -- lesson-proposal
pnpm turbo check-types --filter=@mulink/api
```

end-to-end: 코치 계정으로 `GET /lesson-requests` → isProposed=false 확인 → `POST /lesson-requests/:id/lesson-proposals` 제안 → 다시 목록 조회 시 isProposed=true, 재제안 시 409 → 학생 계정으로 `GET /lesson-requests/me` 응답에 해당 제안이 coachProfile과 함께 최신순으로 나오는지 확인.

## 이번 범위 밖 (다음 작업)

- `GET /lesson-proposals/me` (코치: 내가 보낸 제안 목록)
- `DELETE /lesson-proposals/:id` (제안 취소)
- 프론트 연동 (`LessonOffer` 타입 수정, page.tsx `proposals` 실제 연결, 코치 목록/제안 UI)
