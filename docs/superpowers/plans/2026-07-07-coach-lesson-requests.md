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
- Create: `src/features/lesson-proposal/lesson-proposal.action.ts` — `createLessonProposalAction`
- Create: `src/features/lesson-proposal/ui/LessonRequestList.tsx` — `'use client'` 스트립 리스트 + 인라인 제안 폼
- Modify: `src/app/(coach)/coach/lesson-requests/page.tsx` — 서버 컴포넌트, 목록 fetch → 리스트/빈 상태

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

## Task 4: 프론트 Server Action — createLessonProposalAction

**Files:**
- Create: `apps/web/src/features/lesson-proposal/lesson-proposal.action.ts`

- [ ] **Step 1: 액션 파일 생성**

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

- [ ] **Step 2: 타입체크**

Run: `pnpm turbo check-types --filter=@mulink/web`
Expected: PASS.

- [ ] **Step 3: 커밋**

```bash
git add apps/web/src/features/lesson-proposal/lesson-proposal.action.ts
git commit -m "feat(web): add createLessonProposalAction"
```

---

## Task 5: 프론트 리스트 UI — LessonRequestList

**Files:**
- Create: `apps/web/src/features/lesson-proposal/ui/LessonRequestList.tsx`

**참고 (구현 전 확인):** `apps/web/AGENTS.md` — 이 Next.js는 breaking change가 있을 수 있으니, 필요 시 `apps/web/node_modules/next/dist/docs/01-app/` 문서를 확인. 이 컴포넌트는 `'use client'`이고 `useRouter`는 `next/navigation`에서 import한다.

shared/ui 재사용: `Button`(variant `default`/`outline`/`ghost`, size `sm`, prop `loading`), `Badge`(variant `brand`=지역, `neutral`=장르, `success`+`dot`=제안완료), `Textarea`. 아이콘은 `lucide-react`(프로젝트에 이미 설치됨).

- [ ] **Step 1: 컴포넌트 생성**

```tsx
'use client';

import { useState, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Music, Target, Send, Check, X, Clock, FileText } from 'lucide-react';
import { Button } from '@/shared/ui/button/button';
import { Badge } from '@/shared/ui/badge/badge';
import { Textarea } from '@/shared/ui/textarea/textarea';
import { REGION_LABEL, GENRE_LABEL } from '@/entities/lesson-request/lesson-request.type';
import type { OpenLessonRequest } from '@/entities/lesson-request/lesson-request.type';
import { createLessonProposalAction } from '../lesson-proposal.action';

// 아바타 이니셜 배경색: 닉네임 기반으로 팔레트에서 하나 고른다(항상 같은 색)
const AVATAR_COLORS = ['#3B6B4F', '#6B7E63', '#A8966F', '#5B7E8A', '#7E6B8A'];
function avatarColor(name: string) {
  let sum = 0;
  for (const ch of name) sum += ch.charCodeAt(0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

// createdAt(ISO)로 "방금 전 / N분 전 / N시간 전 / N일 전" 계산
function relativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  return `${Math.floor(hour / 24)}일 전`;
}

export function LessonRequestList({ requests }: { requests: OpenLessonRequest[] }) {
  const router = useRouter();
  // 현재 인라인 폼이 열린 신청 id (하나만 열림)
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 제안 폼 열기/닫기
  const toggle = (id: string) => {
    setExpandedId((cur) => (cur === id ? null : id));
    setMessage('');
  };

  // 제안 전송 핸들러
  const handleSend = (id: string) => {
    const msg = message.trim();
    if (!msg || pending) return;
    startTransition(async () => {
      const result = await createLessonProposalAction(id, msg);
      if (result?.error) {
        alert(result.error);
        return;
      }
      setExpandedId(null);
      setMessage('');
      router.refresh(); // 서버 목록 재검증 → isProposed 갱신
    });
  };

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center gap-5 rounded-2xl border border-[var(--neutral-200)] bg-white px-6 py-20 text-center">
        <div className="flex size-20 items-center justify-center rounded-full bg-[var(--green-50)] text-[var(--green-300)]">
          <FileText size={38} />
        </div>
        <div>
          <p className="mb-2 text-[17px] font-bold text-[var(--neutral-800)]">아직 모집 중인 레슨 신청이 없어요</p>
          <p className="text-sm leading-relaxed break-keep text-[var(--neutral-500)]">
            학생들이 새 레슨 신청을 올리면 여기에 나타나요.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {requests.map((req) => {
        const expanded = expandedId === req.id;
        return (
          <div
            key={req.id}
            className={`overflow-hidden rounded-2xl border bg-white transition-colors ${
              expanded ? 'border-[var(--green-200)]' : 'border-[var(--neutral-200)]'
            }`}
          >
            {/* 스트립 행 */}
            <div className="flex items-center gap-3.5 px-5 py-3.5">
              <div
                className="flex size-[38px] shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ backgroundColor: avatarColor(req.studentNickname) }}
              >
                {req.studentNickname[0]}
              </div>
              <div className="w-24 shrink-0">
                <div className={`text-sm font-semibold ${req.isProposed ? 'text-[var(--neutral-400)]' : 'text-[var(--neutral-900)]'}`}>
                  {req.studentNickname}
                </div>
                <div className="mt-0.5 flex items-center gap-1 text-[11px] text-[var(--neutral-400)]">
                  <Clock size={10} />
                  {relativeTime(req.createdAt)}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-1.5">
                <Badge variant="brand"><MapPin size={11} />{REGION_LABEL[req.region]}</Badge>
                <Badge variant="neutral"><Music size={11} />{GENRE_LABEL[req.genre]}</Badge>
              </div>
              <p className={`min-w-0 flex-1 truncate text-[13px] ${req.isProposed ? 'text-[var(--neutral-400)]' : 'text-[var(--neutral-600)]'}`}>
                {req.goal}
              </p>
              <div className="shrink-0">
                {req.isProposed ? (
                  <Badge variant="success" dot><Check size={11} />제안 완료</Badge>
                ) : (
                  <Button size="sm" variant={expanded ? 'outline' : 'default'} onClick={() => toggle(req.id)}>
                    {expanded ? <><X size={13} />닫기</> : <><Send size={13} />제안</>}
                  </Button>
                )}
              </div>
            </div>

            {/* 인라인 제안 폼 */}
            {expanded && (
              <div className="border-t border-[var(--neutral-100)] bg-[var(--green-50)] px-5 py-4">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[var(--green-700)]">
                  <Target size={13} />
                  {req.studentNickname}님께 한마디
                </div>
                <Textarea
                  ref={textareaRef}
                  autoFocus
                  rows={3}
                  className="bg-white"
                  placeholder="학생에게 전할 한마디를 적어 주세요."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend(req.id);
                    if (e.key === 'Escape') setExpandedId(null);
                  }}
                />
                <div className="mt-2.5 flex items-center justify-between gap-2">
                  <span className="text-xs text-[var(--neutral-400)]">⌘/Ctrl + Enter로 바로 전송</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setExpandedId(null)}>취소</Button>
                    <Button
                      size="sm"
                      loading={pending}
                      disabled={!message.trim()}
                      onClick={() => handleSend(req.id)}
                    >
                      {!pending && <Send size={13} />}
                      제안 전송
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: 타입체크 (아직 페이지에서 미사용이라 unused 경고만 확인)**

Run: `pnpm turbo check-types --filter=@mulink/web`
Expected: PASS.

- [ ] **Step 3: 커밋**

```bash
git add apps/web/src/features/lesson-proposal/ui/LessonRequestList.tsx
git commit -m "feat(web): add LessonRequestList with inline proposal form"
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
          <h1 className="text-2xl font-extrabold tracking-tight text-[var(--neutral-900)]">레슨 신청 목록</h1>
          {requests.length > 0 && (
            <span className="text-[15px] font-medium text-[var(--neutral-400)]">{requests.length}개 모집 중</span>
          )}
        </div>
        <p className="text-sm leading-relaxed text-[var(--neutral-500)]">
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

- **Spec 커버리지**: 백엔드 닉네임(Task1) / 타입(Task2) / 조회(Task3) / 액션(Task4) / 리스트UI+인라인폼(Task5) / 페이지(Task6) / 검증(Task7) — spec의 모든 파일·요구사항 대응.
- **타입 일관성**: `OpenLessonRequest`(studentNickname, region, goal, genre, createdAt, isProposed)를 Task2에서 정의하고 Task3/5/6에서 동일 필드로 사용. `createLessonProposalAction(requestId, message)` 시그니처 Task4 정의 = Task5 호출 일치.
- **YAGNI**: 레이아웃 B/C/D·공용 RequestCard·TweaksPanel·VocalTier·낙관적 업데이트 모두 제외.
- **주의**: `LessonRequestList`는 `'use client'`이며 성능상 목록이 커지면 행 컴포넌트 분리를 고려할 수 있으나, 현재 규모(단일 목록)에선 불필요.
