# 코치 레슨 신청 목록 페이지 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 코치가 `/coach/lesson-requests`에서 모집중 레슨 신청 목록을 보고 각 신청에 인라인으로 제안 메시지를 보내는 페이지(시안 레이아웃 A)를 구현한다.

**Architecture:** 서버 컴포넌트 `page.tsx`가 `getOpenLessonRequests()`로 목록을 fetch해 `'use client'` 리스트 컴포넌트에 전달한다. 제안 전송은 Server Action `createLessonProposalAction`으로 처리하고 성공 시 `router.refresh()`로 목록을 재검증한다. 백엔드는 응답에 학생 닉네임을 추가한다.

**Tech Stack:** NestJS 11 + Prisma 7 (api), Next.js 16 App Router + React 19 + Tailwind v4 + shadcn(shared/ui) (web), Jest (api 테스트).

---

## File Structure

**백엔드 (apps/api):**
- Modify: `src/lesson-request/lesson-request.service.ts` — `getOpenLessonRequests`에 student 닉네임 include + 평탄화
- Modify: `src/lesson-request/lesson-request.service.spec.ts` — 닉네임 반환 검증 추가

**프론트 (apps/web):**
- Modify: `src/entities/lesson-request/lesson-request.type.ts` — `OpenLessonRequest` 타입 추가
- Modify: `src/entities/lesson-request/lesson-request.api.ts` — `getOpenLessonRequests()` 추가
- Create: `src/features/lesson-proposal/lesson-proposal.action.ts` (+ `.test.ts`) — `createLessonProposalAction`
- Create: `src/features/lesson-proposal/lesson-proposal.schema.ts` (+ `.test.ts`) — RHF용 zod 제안 폼 스키마
- Create: `src/shared/lib/relative-time.ts` (+ `.test.ts`) — ISO 날짜 → 상대시간 문자열 유틸
- Create: `src/features/lesson-proposal/ui/LessonRequestList.tsx` (+ `.test.tsx`) — `'use client'` 스트립 리스트 + RHF 인라인 제안 폼
- Modify: `src/app/(coach)/coach/lesson-requests/page.tsx` — 서버 컴포넌트, 목록 fetch → 리스트/빈 상태

**테스트 도구:** api는 Jest(`*.service.spec.ts`), web은 Vitest + @testing-library/react(`*.test.ts` / `*.test.tsx`). 폼은 react-hook-form + zodResolver(기존 `coach-register` 패턴).

---

## Task 1: 백엔드 — 응답에 학생 닉네임 추가

**Files:**
- Modify: `apps/api/src/lesson-request/lesson-request.service.ts:87-103`
- Test: `apps/api/src/lesson-request/lesson-request.service.spec.ts:153-183`

- [ ] **Step 1: 기존 테스트를 닉네임 검증으로 업데이트 (실패 확인용)**

`apps/api/src/lesson-request/lesson-request.service.spec.ts`의 "코치가 호출하면 각 신청에 isProposed를 붙여 반환한다" 테스트(153-183줄)를 아래로 교체한다. mock 데이터에 `student.nickname`을 넣고, 반환값에 `studentNickname`이 평탄화됐는지, `student` 원본 키가 제거됐는지 검증한다.

```ts
    it('코치가 호출하면 각 신청에 isProposed와 studentNickname을 붙여 반환한다', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'coach-1',
        role: 'COACH',
      });
      prisma.lessonRequest.findMany.mockResolvedValue([
        {
          id: 'req-1',
          region: 'SEOUL',
          goal: 'g1',
          genre: 'POP',
          createdAt: new Date(),
          student: { nickname: '김민지' },
        },
        {
          id: 'req-2',
          region: 'BUSAN',
          goal: 'g2',
          genre: 'ROCK',
          createdAt: new Date(),
          student: { nickname: '이준호' },
        },
      ]);
      // 코치가 이미 req-1에 제안함
      prisma.lessonProposal.findMany.mockResolvedValue([
        { requestId: 'req-1' },
      ]);

      const result = await service.getOpenLessonRequests('coach-1');

      // student 관계를 닉네임만 include하는지 확인
      expect(prisma.lessonRequest.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
        include: { student: { select: { nickname: true } } },
      });
      // 평탄화 결과
      expect(result[0].studentNickname).toBe('김민지');
      expect(result[0].isProposed).toBe(true);
      expect(result[1].studentNickname).toBe('이준호');
      expect(result[1].isProposed).toBe(false);
      // 내부 관계 키는 노출하지 않음
      expect((result[0] as Record<string, unknown>).student).toBeUndefined();
    });
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `pnpm --filter=@mulink/api test -- lesson-request.service`
Expected: FAIL — `findMany`가 `include` 없이 호출됨 / `studentNickname`이 undefined.

- [ ] **Step 3: service 구현 — include + 평탄화**

`apps/api/src/lesson-request/lesson-request.service.ts`의 `getOpenLessonRequests` 2단계/4단계를 아래로 수정한다.

2단계 (87-89줄) `findMany` 호출에 include 추가:

```ts
    // 2단계: 모집중 신청 전체 조회 (최신순) — 학생 닉네임만 함께 조회
    const requests = await this.prisma.lessonRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: { student: { select: { nickname: true } } },
    });
```

4단계 (100-103줄) map에서 닉네임 평탄화 + student 원본 제외:

```ts
    // 4단계: 각 신청에 isProposed·studentNickname을 붙이고 내부 관계는 감춘다
    return requests.map(({ student, ...request }) => ({
      ...request,
      studentNickname: student.nickname,
      isProposed: proposedIds.has(request.id),
    }));
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter=@mulink/api test -- lesson-request.service`
Expected: PASS (전체 lesson-request 테스트).

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src/lesson-request/lesson-request.service.ts apps/api/src/lesson-request/lesson-request.service.spec.ts
git commit -m "feat(api): include student nickname in open lesson requests"
```

---

## Task 2: 프론트 타입 — OpenLessonRequest 추가

**Files:**
- Modify: `apps/web/src/entities/lesson-request/lesson-request.type.ts`

- [ ] **Step 1: 타입 추가**

`apps/web/src/entities/lesson-request/lesson-request.type.ts`에서 기존 `LessonRequest` 타입 정의(24줄) 바로 아래에 추가한다. 백엔드 `getOpenLessonRequests` 응답과 1:1 대응.

```ts
// 코치가 보는 모집중 레슨 신청 한 건. 백엔드 GET /lesson-requests 응답과 1:1 대응.
// (내 신청 조회와 달리 studentId 대신 studentNickname과 isProposed가 붙는다)
export type OpenLessonRequest = {
  id: string;
  studentNickname: string;
  region: Region;
  goal: string;
  genre: Genre;
  createdAt: string; // JSON 직렬화되면서 Date가 ISO 문자열로 전달됨
  isProposed: boolean; // 현재 코치가 이미 제안했는지
};
```

- [ ] **Step 2: 타입체크**

Run: `pnpm turbo check-types --filter=@mulink/web`
Expected: PASS (새 타입만 추가, 아직 미사용이라 에러 없음).

- [ ] **Step 3: 커밋**

```bash
git add apps/web/src/entities/lesson-request/lesson-request.type.ts
git commit -m "feat(web): add OpenLessonRequest type"
```

---

## Task 3: 프론트 조회 API — getOpenLessonRequests

**Files:**
- Modify: `apps/web/src/entities/lesson-request/lesson-request.api.ts`

- [ ] **Step 1: 조회 함수 추가**

`apps/web/src/entities/lesson-request/lesson-request.api.ts` 맨 아래에 추가한다. 기존 `getMyLessonRequest`와 동일한 패턴(supabase 토큰 첨부, `cache()`, `cache: 'no-store'`). 실패 시 빈 배열 반환.

먼저 1번 줄 import에 타입을 추가:

```ts
import type { LessonRequest, OpenLessonRequest } from './lesson-request.type';
```

파일 끝에 함수 추가:

```ts
// 코치용 모집중 레슨 신청 목록을 가져온다. 비로그인/권한없음/오류면 빈 배열.
export const getOpenLessonRequests = cache(async (): Promise<OpenLessonRequest[]> => {
  const supabase = await createClient();

  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) return [];

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/lesson-requests`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!response.ok) return []; // 권한없음(403)/토큰만료(401) 등

  return (await response.json()) as OpenLessonRequest[];
});
```

- [ ] **Step 2: 타입체크**

Run: `pnpm turbo check-types --filter=@mulink/web`
Expected: PASS.

- [ ] **Step 3: 커밋**

```bash
git add apps/web/src/entities/lesson-request/lesson-request.api.ts
git commit -m "feat(web): add getOpenLessonRequests fetch"
```

---

## Task 4: 프론트 Server Action — createLessonProposalAction (TDD)

**Files:**
- Create: `apps/web/src/features/lesson-proposal/lesson-proposal.action.ts`
- Test: `apps/web/src/features/lesson-proposal/lesson-proposal.action.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/web/src/features/lesson-proposal/lesson-proposal.action.test.ts` 생성. 기존 `lesson-register.action.test.ts` 패턴(vitest + `vi.mock` supabase + `global.fetch`)을 그대로 따른다.

```ts
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/shared/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

global.fetch = vi.fn();

import { createLessonProposalAction } from './lesson-proposal.action';
import { createClient } from '@/shared/lib/supabase/server';

// access_token 세션을 돌려주는 supabase mock
function mockSession(token: string | null) {
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getSession: vi
        .fn()
        .mockResolvedValue({ data: { session: token ? { access_token: token } : null } }),
    },
  } as never);
}

describe('createLessonProposalAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('세션 없으면 로그인 필요 에러를 반환한다', async () => {
    mockSession(null);

    const result = await createLessonProposalAction('req-1', '안녕하세요');

    expect(result).toEqual({ error: '로그인이 필요합니다.' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('성공 시 requestId 경로로 POST하고 에러 없이 반환한다', async () => {
    mockSession('test-token');
    vi.mocked(fetch).mockResolvedValue({ ok: true } as never);

    const result = await createLessonProposalAction('req-1', '안녕하세요');

    expect(result).toBeUndefined();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/lesson-requests/req-1/lesson-proposals'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('fetch 실패 시 body의 message를 에러로 반환한다', async () => {
    mockSession('test-token');
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: vi.fn().mockResolvedValue({ message: '이미 제안한 레슨 신청입니다.' }),
    } as never);

    const result = await createLessonProposalAction('req-1', '안녕하세요');

    expect(result).toEqual({ error: '이미 제안한 레슨 신청입니다.' });
  });

  it('실패하고 message 없으면 기본 에러 메시지를 반환한다', async () => {
    mockSession('test-token');
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: vi.fn().mockResolvedValue({}),
    } as never);

    const result = await createLessonProposalAction('req-1', '안녕하세요');

    expect(result).toEqual({ error: '제안 전송에 실패했습니다.' });
  });
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `pnpm --filter=@mulink/web exec vitest run lesson-proposal.action`
Expected: FAIL — `lesson-proposal.action.ts`가 없어 import 에러.

- [ ] **Step 3: 액션 파일 생성**

`apps/web/src/features/lesson-proposal/lesson-proposal.action.ts` 생성. 기존 `lesson-register.action.ts` 패턴 그대로: 토큰 첨부, `POST`, 에러는 `{ error }` 반환.

```ts
'use server';

import { createClient } from '@/shared/lib/supabase/server';

// 레슨 신청(requestId)에 제안 메시지를 보낸다. 성공하면 void, 실패하면 { error }.
export async function createLessonProposalAction(
  requestId: string,
  message: string,
): Promise<{ error: string } | void> {
  const supabase = await createClient();
  // Bearer 토큰을 백엔드에 넘겨야 하는 구조상 getSession() 사용 (검증은 백엔드 Guard)
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    return { error: '로그인이 필요합니다.' };
  }

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/lesson-requests/${requestId}/lesson-proposals`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ message }),
    },
  );

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    return { error: body.message ?? '제안 전송에 실패했습니다.' };
  }

  // 성공: 호출한 클라이언트가 router.refresh()로 목록을 갱신한다
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter=@mulink/web exec vitest run lesson-proposal.action`
Expected: PASS (4 tests).

- [ ] **Step 5: 커밋**

```bash
git add apps/web/src/features/lesson-proposal/lesson-proposal.action.ts apps/web/src/features/lesson-proposal/lesson-proposal.action.test.ts
git commit -m "feat(web): add createLessonProposalAction"
```

---

## Task 4.5: 제안 폼 스키마 — lesson-proposal.schema.ts (TDD)

**Files:**
- Create: `apps/web/src/features/lesson-proposal/lesson-proposal.schema.ts`
- Test: `apps/web/src/features/lesson-proposal/lesson-proposal.schema.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/web/src/features/lesson-proposal/lesson-proposal.schema.test.ts` 생성. 기존 `coach-register.schema.test.ts` 스타일(zod `safeParse` 검증).

```ts
import { describe, it, expect } from 'vitest';
import { LessonProposalSchema } from './lesson-proposal.schema';

describe('LessonProposalSchema', () => {
  it('message가 있으면 통과한다', () => {
    const result = LessonProposalSchema.safeParse({ message: '안녕하세요, 함께 해요' });
    expect(result.success).toBe(true);
  });

  it('공백만이면 실패한다', () => {
    const result = LessonProposalSchema.safeParse({ message: '   ' });
    expect(result.success).toBe(false);
  });

  it('빈 문자열이면 실패한다', () => {
    const result = LessonProposalSchema.safeParse({ message: '' });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `pnpm --filter=@mulink/web exec vitest run lesson-proposal.schema`
Expected: FAIL — 스키마 파일 없음.

- [ ] **Step 3: 스키마 작성**

`apps/web/src/features/lesson-proposal/lesson-proposal.schema.ts` 생성.

```ts
import { z } from 'zod';

// 제안 한마디 폼 스키마 (공백만이면 거부 — 백엔드 검증과 동일)
export const LessonProposalSchema = z.object({
  message: z.string().trim().min(1, '제안 한마디를 입력해 주세요.'),
});

// 제안 폼 타입
export type LessonProposalFormType = z.infer<typeof LessonProposalSchema>;
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter=@mulink/web exec vitest run lesson-proposal.schema`
Expected: PASS (3 tests).

- [ ] **Step 5: 커밋**

```bash
git add apps/web/src/features/lesson-proposal/lesson-proposal.schema.ts apps/web/src/features/lesson-proposal/lesson-proposal.schema.test.ts
git commit -m "feat(web): add lesson proposal form schema"
```

---

## Task 4.6: 상대시간 유틸 — shared/lib/relative-time.ts (TDD)

**Files:**
- Create: `apps/web/src/shared/lib/relative-time.ts`
- Test: `apps/web/src/shared/lib/relative-time.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/web/src/shared/lib/relative-time.test.ts` 생성. `Date.now()`를 고정해 경계값을 검증한다.

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { toRelativeTime } from './relative-time';

const NOW = new Date('2026-07-07T12:00:00.000Z').getTime();

afterEach(() => {
  vi.useRealTimers();
});

function isoMinutesAgo(min: number) {
  return new Date(NOW - min * 60000).toISOString();
}

describe('toRelativeTime', () => {
  it('1분 미만이면 "방금 전"', () => {
    vi.setSystemTime(NOW);
    expect(toRelativeTime(isoMinutesAgo(0))).toBe('방금 전');
  });

  it('분 단위', () => {
    vi.setSystemTime(NOW);
    expect(toRelativeTime(isoMinutesAgo(5))).toBe('5분 전');
  });

  it('시간 단위', () => {
    vi.setSystemTime(NOW);
    expect(toRelativeTime(isoMinutesAgo(3 * 60))).toBe('3시간 전');
  });

  it('일 단위', () => {
    vi.setSystemTime(NOW);
    expect(toRelativeTime(isoMinutesAgo(2 * 24 * 60))).toBe('2일 전');
  });
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `pnpm --filter=@mulink/web exec vitest run relative-time`
Expected: FAIL — 유틸 파일 없음.

- [ ] **Step 3: 유틸 작성**

`apps/web/src/shared/lib/relative-time.ts` 생성.

```ts
// ISO 날짜 문자열을 "방금 전 / N분 전 / N시간 전 / N일 전"으로 변환한다.
export function toRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  return `${Math.floor(hour / 24)}일 전`;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter=@mulink/web exec vitest run relative-time`
Expected: PASS (4 tests).

- [ ] **Step 5: 커밋**

```bash
git add apps/web/src/shared/lib/relative-time.ts apps/web/src/shared/lib/relative-time.test.ts
git commit -m "feat(web): add toRelativeTime util"
```

---

## Task 5: 프론트 리스트 UI — LessonRequestList (TDD)

**Files:**
- Create: `apps/web/src/features/lesson-proposal/ui/LessonRequestList.tsx`
- Test: `apps/web/src/features/lesson-proposal/ui/LessonRequestList.test.tsx`

**참고 (구현 전 확인):** `apps/web/AGENTS.md` — 이 Next.js는 breaking change가 있을 수 있으니, 필요 시 `apps/web/node_modules/next/dist/docs/01-app/` 문서를 확인. 이 컴포넌트는 `'use client'`이고 `useRouter`는 `next/navigation`에서 import한다.

**구조:** 각 행은 독립된 RHF 폼(펼침/입력값/제출 상태)을 가지므로 `LessonRequestRow`를 파일 안에 분리하고, `LessonRequestList`는 매핑·빈 상태만 담당한다. 폼은 `coach-register` 패턴(`useForm` + `zodResolver`)을 따른다.

shared/ui 재사용: `Button`(variant `default`/`outline`, size `sm`, prop `loading`), `Badge`(variant `brand`=지역, `neutral`=장르, `success`+`dot`=제안완료), `Textarea`. 아이콘은 `lucide-react`(프로젝트에 이미 설치됨). 상대시간은 `toRelativeTime`(Task 4.6) import. 폼 스키마는 `LessonProposalSchema`(Task 4.5) import.

- [ ] **Step 1: 실패하는 컴포넌트 테스트 작성**

`apps/web/src/features/lesson-proposal/ui/LessonRequestList.test.tsx` 생성. 기존 `ui/*.test.tsx`(@testing-library/react) 스타일. 액션과 `useRouter`를 mock한다.

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LessonRequestList } from './LessonRequestList';
import { createLessonProposalAction } from '../lesson-proposal.action';
import type { OpenLessonRequest } from '@/entities/lesson-request/lesson-request.type';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('../lesson-proposal.action', () => ({ createLessonProposalAction: vi.fn() }));

const baseReq: OpenLessonRequest = {
  id: 'req-1',
  studentNickname: '민지',
  region: 'SEOUL',
  goal: '음정 교정하고 싶어요',
  genre: 'POP',
  createdAt: new Date().toISOString(),
  isProposed: false,
};

describe('LessonRequestList', () => {
  beforeEach(() => vi.clearAllMocks());

  it('목록이 비면 빈 상태 문구를 보여준다', () => {
    render(<LessonRequestList requests={[]} />);
    expect(screen.getByText('아직 모집 중인 레슨 신청이 없어요')).toBeInTheDocument();
  });

  it('제안 완료된 신청은 배지를 보여주고 제안 버튼이 없다', () => {
    render(<LessonRequestList requests={[{ ...baseReq, isProposed: true }]} />);
    expect(screen.getByText('제안 완료')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /제안/ })).not.toBeInTheDocument();
  });

  it('제안 버튼을 누르면 폼이 열리고, 빈 메시지 제출은 검증 에러를 낸다', async () => {
    const user = userEvent.setup();
    render(<LessonRequestList requests={[baseReq]} />);

    await user.click(screen.getByRole('button', { name: /제안/ }));
    const textarea = screen.getByPlaceholderText('학생에게 전할 한마디를 적어 주세요.');
    expect(textarea).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '제안 전송' }));
    expect(await screen.findByText('제안 한마디를 입력해 주세요.')).toBeInTheDocument();
    expect(createLessonProposalAction).not.toHaveBeenCalled();
  });

  it('메시지 입력 후 전송하면 액션 호출 + router.refresh()', async () => {
    vi.mocked(createLessonProposalAction).mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<LessonRequestList requests={[baseReq]} />);

    await user.click(screen.getByRole('button', { name: /제안/ }));
    await user.type(screen.getByPlaceholderText('학생에게 전할 한마디를 적어 주세요.'), '함께 해요');
    await user.click(screen.getByRole('button', { name: '제안 전송' }));

    expect(createLessonProposalAction).toHaveBeenCalledWith('req-1', '함께 해요');
    expect(refresh).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `pnpm --filter=@mulink/web exec vitest run LessonRequestList`
Expected: FAIL — 컴포넌트 파일 없음.

- [ ] **Step 3: 컴포넌트 생성**

```tsx
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { MapPin, Music, Target, Send, Check, X, Clock, FileText } from 'lucide-react';
import { Button } from '@/shared/ui/button/button';
import { Badge } from '@/shared/ui/badge/badge';
import { Textarea } from '@/shared/ui/textarea/textarea';
import { toRelativeTime } from '@/shared/lib/relative-time';
import { REGION_LABEL, GENRE_LABEL } from '@/entities/lesson-request/lesson-request.type';
import type { OpenLessonRequest } from '@/entities/lesson-request/lesson-request.type';
import { LessonProposalSchema, type LessonProposalFormType } from '../lesson-proposal.schema';
import { createLessonProposalAction } from '../lesson-proposal.action';

// 아바타 이니셜 배경색: 닉네임 기반으로 팔레트에서 하나 고른다(항상 같은 색)
const AVATAR_COLORS = ['#3B6B4F', '#6B7E63', '#A8966F', '#5B7E8A', '#7E6B8A'];
function pickAvatarColor(name: string) {
  let sum = 0;
  for (const ch of name) sum += ch.charCodeAt(0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

// 한 건의 신청 행 + 인라인 제안 폼. 각 행이 독립된 폼 상태를 가진다.
function LessonRequestRow({ request }: { request: OpenLessonRequest }) {
  const router = useRouter();
  const [isFormOpen, setIsFormOpen] = useState(false);

  const { register, handleSubmit, reset, formState } = useForm<LessonProposalFormType>({
    resolver: zodResolver(LessonProposalSchema),
    defaultValues: { message: '' },
  });
  const { errors, isSubmitting } = formState;

  // 제안 폼 열기/닫기 토글
  const toggleProposalForm = () => {
    setIsFormOpen((open) => !open);
    reset();
  };

  // 제안 전송 핸들러
  const handleSendProposal = handleSubmit(async ({ message }) => {
    const result = await createLessonProposalAction(request.id, message);
    if (result?.error) {
      alert(result.error);
      return;
    }
    setIsFormOpen(false);
    reset();
    router.refresh(); // 서버 목록 재검증 → isProposed 갱신
  });

  return (
    <div
      className={`overflow-hidden rounded-2xl border bg-white transition-colors ${
        isFormOpen ? 'border-(--green-200)' : 'border-(--neutral-200)'
      }`}
    >
      {/* 스트립 행 */}
      <div className="flex items-center gap-3.5 px-5 py-3.5">
        <div
          className="flex size-9.5 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{ backgroundColor: pickAvatarColor(request.studentNickname) }}
        >
          {request.studentNickname[0]}
        </div>
        <div className="w-24 shrink-0">
          <div className={`text-sm font-semibold ${request.isProposed ? 'text-(--neutral-400)' : 'text-(--neutral-900)'}`}>
            {request.studentNickname}
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-(--neutral-400)">
            <Clock size={10} />
            {toRelativeTime(request.createdAt)}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5">
          <Badge variant="brand"><MapPin size={11} />{REGION_LABEL[request.region]}</Badge>
          <Badge variant="neutral"><Music size={11} />{GENRE_LABEL[request.genre]}</Badge>
        </div>
        <p className={`min-w-0 flex-1 truncate text-[13px] ${request.isProposed ? 'text-(--neutral-400)' : 'text-(--neutral-600)'}`}>
          {request.goal}
        </p>
        <div className="shrink-0">
          {request.isProposed ? (
            <Badge variant="success" dot><Check size={11} />제안 완료</Badge>
          ) : (
            <Button size="sm" variant={isFormOpen ? 'outline' : 'default'} onClick={toggleProposalForm}>
              {isFormOpen ? <><X size={13} />닫기</> : <><Send size={13} />제안</>}
            </Button>
          )}
        </div>
      </div>

      {/* 인라인 제안 폼 */}
      {isFormOpen && (
        <form onSubmit={handleSendProposal} noValidate className="border-t border-(--neutral-100) bg-(--green-50) px-5 py-4">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-(--green-700)">
            <Target size={13} />
            {request.studentNickname}님께 한마디
          </div>
          <Textarea
            autoFocus
            rows={3}
            className="bg-white"
            placeholder="학생에게 전할 한마디를 적어 주세요."
            aria-invalid={errors.message ? 'true' : undefined}
            {...register('message')}
          />
          {errors.message && (
            <p role="alert" className="mt-1.5 text-xs text-destructive">
              {errors.message.message}
            </p>
          )}
          <div className="mt-2.5 flex items-center justify-end gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setIsFormOpen(false)}>
              취소
            </Button>
            <Button type="submit" size="sm" loading={isSubmitting} leftIcon={<Send size={13} />}>
              제안 전송
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

export function LessonRequestList({ requests }: { requests: OpenLessonRequest[] }) {
  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center gap-5 rounded-2xl border border-(--neutral-200) bg-white px-6 py-20 text-center">
        <div className="flex size-20 items-center justify-center rounded-full bg-(--green-50) text-(--green-300)">
          <FileText size={38} />
        </div>
        <div>
          <p className="mb-2 text-[17px] font-bold text-(--neutral-800)">아직 모집 중인 레슨 신청이 없어요</p>
          <p className="text-sm leading-relaxed break-keep text-(--neutral-500)">
            학생들이 새 레슨 신청을 올리면 여기에 나타나요.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {requests.map((request) => (
        <LessonRequestRow key={request.id} request={request} />
      ))}
    </div>
  );
}
```

**주의:** 시안의 ⌘/Ctrl+Enter 단축 전송은 RHF `handleSubmit`을 `<form onSubmit>`으로 쓰면서 제거했다(폼 제출 = 버튼 기준). 필요하면 이후 별도 추가 가능. Escape 닫기도 동일하게 제외.

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter=@mulink/web exec vitest run LessonRequestList`
Expected: PASS (4 tests).

- [ ] **Step 5: 커밋**

```bash
git add apps/web/src/features/lesson-proposal/ui/LessonRequestList.tsx apps/web/src/features/lesson-proposal/ui/LessonRequestList.test.tsx
git commit -m "feat(web): add LessonRequestList with RHF inline proposal form"
```

---

## Task 6: 페이지 연결 — 서버 컴포넌트에서 목록 fetch

**Files:**
- Modify: `apps/web/src/app/(coach)/coach/lesson-requests/page.tsx`

- [ ] **Step 1: 페이지를 목록 fetch + 리스트 렌더로 교체**

`apps/web/src/app/(coach)/coach/lesson-requests/page.tsx` 전체를 아래로 교체한다. 서버 컴포넌트에서 목록을 가져와 클라이언트 리스트에 넘긴다. 헤딩은 시안 PageHeading 재현.

```tsx
import { getOpenLessonRequests } from '@/entities/lesson-request/lesson-request.api';
import { LessonRequestList } from '@/features/lesson-proposal/ui/LessonRequestList';

export default async function CoachLessonRequestsPage() {
  const requests = await getOpenLessonRequests();

  return (
    <div className="mx-auto w-full max-w-[1040px] px-8 py-8 pb-16">
      {/* 페이지 헤딩 */}
      <div className="mb-7">
        <div className="mb-1.5 flex items-baseline gap-2.5">
          <h1 className="text-2xl font-extrabold tracking-tight text-(--neutral-900)">레슨 신청 목록</h1>
          {requests.length > 0 && (
            <span className="text-[15px] font-medium text-(--neutral-400)">{requests.length}개 모집 중</span>
          )}
        </div>
        <p className="text-sm leading-relaxed text-(--neutral-500)">
          코치님께 맞는 학생을 찾아 제안을 보내 보세요.
        </p>
      </div>

      <LessonRequestList requests={requests} />
    </div>
  );
}
```

- [ ] **Step 2: 타입체크**

Run: `pnpm turbo check-types --filter=@mulink/web`
Expected: PASS.

- [ ] **Step 3: 커밋**

```bash
git add "apps/web/src/app/(coach)/coach/lesson-requests/page.tsx"
git commit -m "feat(web): wire coach lesson-requests page to open list"
```

---

## Task 7: 통합 검증 (수동)

- [ ] **Step 1: lint + 타입체크 전체**

Run: `pnpm turbo lint check-types --filter=@mulink/web`
Expected: PASS.

- [ ] **Step 2: 백엔드 테스트 전체**

Run: `pnpm --filter=@mulink/api test -- lesson-request.service`
Expected: PASS.

- [ ] **Step 3: dev 서버 띄우고 코치 계정으로 수동 확인**

Run: `pnpm turbo dev` (또는 `--filter`로 web/api 각각)
확인 (코치 계정 로그인 후 `/coach/lesson-requests`):
1. 목록이 닉네임/상대시간/지역·장르 배지/목표와 함께 표시된다.
2. "제안" 버튼 클릭 → 카드 내부에 textarea가 인라인 확장된다.
3. 메시지 입력 후 ⌘/Ctrl+Enter 또는 "제안 전송" → 전송된다.
4. 전송 성공 후 해당 카드가 "제안 완료" 배지로 바뀐다(router.refresh 반영).
5. 이미 제안한 신청은 처음부터 "제안 완료" 배지로 보인다.
6. 목록이 비면 빈 상태 문구가 보인다.

---

## Self-Review 결과

- **Spec 커버리지**: 백엔드 닉네임(Task1) / 타입(Task2) / 조회(Task3) / 액션+테스트(Task4) / 폼스키마+테스트(Task4.5) / 상대시간 유틸+테스트(Task4.6) / 리스트UI+RHF폼+테스트(Task5) / 페이지(Task6) / 통합검증(Task7) — spec의 모든 파일·요구사항 대응.
- **타입 일관성**: `OpenLessonRequest`(studentNickname, region, goal, genre, createdAt, isProposed)를 Task2에서 정의하고 Task3/5/6에서 동일 필드로 사용. `createLessonProposalAction(requestId, message)` 시그니처 Task4 정의 = Task5 호출 일치. `LessonProposalSchema`/`LessonProposalFormType`(Task4.5), `toRelativeTime`(Task4.6)를 Task5에서 import.
- **테스트 도구 일관성**: api=Jest(`.spec.ts`), web=Vitest(`.test.ts`/`.test.tsx`). 각 신규 프론트 파일마다 TDD(실패 테스트 → 구현 → 통과) 스텝 포함.
- **폼**: react-hook-form + zodResolver(기존 `coach-register` 패턴). 각 행이 독립 폼이라 `LessonRequestRow`로 분리.
- **핸들러 네이밍**: `toggleProposalForm`, `handleSendProposal`, `pickAvatarColor` — 역할이 드러나는 이름.
- **YAGNI / 시안과의 차이**: 레이아웃 B/C/D·공용 RequestCard·TweaksPanel·VocalTier·낙관적 업데이트 제외. RHF `handleSubmit` 도입으로 시안의 ⌘/Ctrl+Enter 단축 전송·Escape 닫기는 제거(버튼 제출 기준). 필요 시 이후 추가 가능.
