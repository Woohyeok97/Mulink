# 코치 레슨 신청 목록 페이지 (레이아웃 A)

## Context

코치가 로그인 후 `/coach/lesson-requests`에서 모집중인 레슨 신청 목록을 보고,
각 신청에 인라인으로 제안 메시지를 보낼 수 있어야 한다. 현재 페이지는 제목만 있는
플레이스홀더 상태다. 백엔드 API(목록 조회 GET, 제안 생성 POST)는 이미 존재한다.

Claude Design 시안(레이아웃 A — 컴팩트 스트립 리스트)을 실제 Next.js + Tailwind v4 +
shared/ui 컴포넌트로 구현한다. 기존 `features` 폴더의 구현 패턴은 참고하지 않고,
CLAUDE.md / frontend-code-style / vercel-react-best-practices / ponytail 가이드에 맞춰 작성한다.

## 아키텍처

```
서버 컴포넌트                          클라이언트 컴포넌트
page.tsx ──fetch목록──▶ LessonRequestList('use client')
  │                          │ 각 행: 인라인 제안 폼 상태 관리
  │                          └─▶ createLessonProposalAction (Server Action)
  └─ getOpenLessonRequests             └─ 성공 시 router.refresh()
     (entities/*.api.ts)
```

- 조회는 서버 컴포넌트에서 `entities` API로, 변경은 `features` Server Action으로 (FSD 컨벤션).
- 인라인 제안 폼은 클라이언트 인터랙션(펼침/입력/로딩)이 필요하므로 리스트만 `'use client'`.
- 제안 전송 성공 시 `router.refresh()`로 서버 목록 재검증 → `isProposed` 갱신. 낙관적 업데이트 없음.

## 백엔드 수정 (1건)

**`apps/api/src/lesson-request/lesson-request.service.ts`** — `getOpenLessonRequests`
- 현재 `student` 관계를 include하지 않아 응답에 학생 이름이 없음.
- Prisma 조회에 `include: { student: { select: { nickname: true } } }` 추가.
- 반환 map에서 `studentNickname: request.student.nickname` 평탄화, `student` 원본은 제외.
- 나머지 응답 형태(`id`, `region`, `genre`, `goal`, `createdAt`, `isProposed`)는 그대로.

## 프론트엔드

### 신규/수정 파일

1. **`apps/web/src/entities/lesson-request/lesson-request.api.ts`** (수정)
   - `getOpenLessonRequests()` 추가. 기존 `getCurrentUser`/`lesson-request.api.ts` 패턴 그대로:
     `'server-only'`, React `cache()`, supabase `getSession().access_token`을 `Authorization: Bearer`로 첨부, `cache: 'no-store'`.
   - `GET ${NEXT_PUBLIC_API_URL}/lesson-requests` 호출. 실패 시 `[]` 반환.

2. **`apps/web/src/entities/lesson-request/lesson-request.type.ts`** (수정)
   - `OpenLessonRequest` 타입 추가: `{ id, studentNickname, region: Region, genre: Genre, goal, createdAt, isProposed }`.
   - 기존 `REGION_LABEL`, `GENRE_LABEL` 재사용(한글 표기).

3. **`apps/web/src/features/lesson-proposal/lesson-proposal.action.ts`** (신규)
   - `createLessonProposalAction(requestId: string, message: string)` — `'use server'`.
   - 기존 `features/lesson-register/lesson-register.action.ts` 패턴: 토큰 첨부, `POST`, `Content-Type: application/json`, body `{ message }`.
   - 성공/실패를 `{ error }` 형태로 반환(throw 대신).
   - `POST ${NEXT_PUBLIC_API_URL}/lesson-requests/:id/lesson-proposals`.

4. **`apps/web/src/app/(coach)/coach/lesson-requests/page.tsx`** (수정)
   - 서버 컴포넌트. `getOpenLessonRequests()`로 목록 fetch → `<LessonRequestList requests={...} />`.
   - 목록이 비면 빈 상태(EmptyState) 표시.
   - 페이지 헤딩(제목 + "N개 모집 중" + 설명)은 시안 PageHeading 재현.

5. **`apps/web/src/features/lesson-proposal/ui/LessonRequestList.tsx`** (신규, `'use client'`)
   - 스트립 카드 리스트. 각 행: 이니셜 아바타 + 닉네임/상대시간 + 지역·장르 배지 + 목표(1줄 말줄임) + "제안" 버튼.
   - "제안" 클릭 → 카드 내부에 textarea 인라인 확장. Cmd/Ctrl+Enter 전송, Esc 닫기, 전송 중 로딩 스피너.
   - 전송 성공 → `router.refresh()` → "제안 완료" 배지로 표시.
   - 상대 시간("방금 전", "N시간 전")은 `createdAt`으로 프론트 계산(작은 헬퍼 함수).

### 스타일 / 컴포넌트 재사용

- 시안의 인라인 스타일/커스텀 CSS를 **Tailwind v4 + 기존 토큰**으로 이전. `--green-*`/`--neutral-*` 토큰은 `globals.css`에 전부 존재하므로 그대로 사용.
- **shared/ui 재사용**: 배지=`badge`(지역/장르/제안완료), 버튼=`button`, 입력=`textarea`. 새 shared 컴포넌트는 만들지 않음.
- 아바타는 시안처럼 닉네임 첫 글자 이니셜 원. 색상은 studentId/닉네임 해시로 뽑는 1줄 함수(별도 컴포넌트 없음).

## 하지 않는 것 (YAGNI)

- 시안의 레이아웃 B/C/D, 공용 `RequestCard`, TweaksPanel은 옮기지 않음 (A만 구현).
- VocalTier 표시 없음 (시안에도 없고, 스키마상 참조 모델 없음).
- 낙관적 업데이트 없음 (`router.refresh()`로 충분).

## 검증

- **백엔드**: `pnpm --filter=@mulink/api test -- lesson-request` — nickname include 후 service 테스트 통과.
- **프론트**: `pnpm turbo dev --filter=@mulink/web` → 코치 계정으로 `/coach/lesson-requests` 접속:
  1. 목록이 닉네임/지역/장르/목표와 함께 표시된다.
  2. "제안" 버튼 → 인라인 textarea 확장, Cmd+Enter로 전송된다.
  3. 전송 후 해당 카드가 "제안 완료" 배지로 바뀐다.
  4. 목록이 비면 빈 상태가 보인다.
