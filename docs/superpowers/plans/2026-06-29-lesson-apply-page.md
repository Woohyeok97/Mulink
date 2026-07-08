# Lesson Apply Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 학생이 레슨을 신청하는 페이지(`/lesson/register`)를 구현하고 기존 `POST /lesson-requests` API에 연결한다.

**Architecture:** `features/coach-register/` 패턴(schema / action / ui)을 미러링한다. `LessonRegisterForm`(`'use client'`)이 `useForm`을 소유하고 `FormProvider`로 좌측 `SidePanel`(스텝 활성화, `useWatch` 구독)과 우측 입력 필드가 form context를 공유한다. 제출 성공 시 redirect 대신 `SuccessView`로 전환한다. 페이지(`page.tsx`)는 서버 컴포넌트로 인증/role 가드만 담당.

**Tech Stack:** Next.js 16 App Router, React 19, react-hook-form + `@hookform/resolvers/zod`, zod, shared/ui(shadcn), Tailwind v4 + globals.css 토큰, lucide-react, vitest.

**참고 문서:** spec `docs/superpowers/specs/2026-06-29-lesson-apply-page-design.md`. 디자인 시안 `Lesson Apply B.html`(Claude Design). 미러링 원본 `apps/web/src/features/coach-register/*`.

**핵심 결정 (API 기준, 백엔드 무수정):** 장르 단일 선택(칩 UI 유지) / 레슨 목표 필수 / 지역 8개 enum / 제출 후 SuccessView 표시 / SidePanel 스텝 3개 실시간 활성화.

---

## File Structure

**생성**
- `apps/web/src/features/lesson-register/lesson-register.schema.ts` — zod 스키마 + REGIONS/GENRES 상수
- `apps/web/src/features/lesson-register/lesson-register.schema.test.ts` — 스키마 단위 테스트
- `apps/web/src/features/lesson-register/lesson-register.action.ts` — 서버 액션(POST)
- `apps/web/src/features/lesson-register/lesson-register.action.test.ts` — 액션 단위 테스트
- `apps/web/src/features/lesson-register/ui/SuccessView.tsx` — 제출 성공 화면
- `apps/web/src/features/lesson-register/ui/SidePanel.tsx` — 좌측 패널(스텝 활성화)
- `apps/web/src/features/lesson-register/ui/LessonRegisterForm.tsx` — 컨테이너 겸 우측 폼

**수정**
- `apps/web/src/app/lesson/register/page.tsx` — 플레이스홀더 → 가드 + 폼

---

## Task 1: 스키마 + 테스트

**Files:**
- Create: `apps/web/src/features/lesson-register/lesson-register.schema.ts`
- Test: `apps/web/src/features/lesson-register/lesson-register.schema.test.ts`

- [ ] **Step 1: 스키마 작성**

`apps/web/src/features/lesson-register/lesson-register.schema.ts`:

```ts
import { z } from 'zod';

export const REGIONS = [
  { value: 'SEOUL', label: '서울' },
  { value: 'GYEONGGI', label: '경기' },
  { value: 'INCHEON', label: '인천' },
  { value: 'BUSAN', label: '부산' },
  { value: 'DAEGU', label: '대구' },
  { value: 'ULSAN', label: '울산' },
  { value: 'GWANGJU', label: '광주' },
  { value: 'DAEJEON', label: '대전' },
] as const;

export type RegionValue = (typeof REGIONS)[number]['value'];

const regionValues = REGIONS.map((region) => region.value) as [RegionValue, ...RegionValue[]];

export const GENRES = [
  { value: 'POP', label: '팝' },
  { value: 'BALLAD', label: '발라드' },
  { value: 'ROCK', label: '록' },
  { value: 'RNB', label: 'R&B' },
  { value: 'JAZZ', label: '재즈' },
  { value: 'HIPHOP', label: '힙합' },
  { value: 'TROT', label: '트로트' },
] as const;

export type GenreValue = (typeof GENRES)[number]['value'];

const genreValues = GENRES.map((genre) => genre.value) as [GenreValue, ...GenreValue[]];

// 레슨 신청 폼 스키마
export const LessonRegisterSchema = z.object({
  region: z.enum(regionValues, {
    error: '지역을 선택해 주세요.',
  }),
  genre: z.enum(genreValues, {
    error: '선호 장르를 선택해 주세요.',
  }),
  goal: z.string().min(1, '레슨 목표를 입력해 주세요.'),
});

// 레슨 신청 폼 타입
export type LessonRegisterFormType = z.infer<typeof LessonRegisterSchema>;
```

- [ ] **Step 2: 테스트 작성**

`apps/web/src/features/lesson-register/lesson-register.schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { LessonRegisterSchema, REGIONS, GENRES } from './lesson-register.schema';

const validInput = { region: 'SEOUL', genre: 'POP', goal: '음치 탈출' } as const;

describe('LessonRegisterSchema', () => {
  it('region, genre, goal이 모두 유효하면 통과한다', () => {
    const result = LessonRegisterSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('goal이 빈 문자열이면 레슨 목표 에러를 반환한다', () => {
    const result = LessonRegisterSchema.safeParse({ ...validInput, goal: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const goalError = result.error.issues.find((issue) => issue.path[0] === 'goal');
      expect(goalError?.message).toBe('레슨 목표를 입력해 주세요.');
    }
  });

  it('region이 undefined이면 에러를 반환한다', () => {
    const result = LessonRegisterSchema.safeParse({ ...validInput, region: undefined });
    expect(result.success).toBe(false);
    if (!result.success) {
      const regionError = result.error.issues.find((issue) => issue.path[0] === 'region');
      expect(regionError).toBeDefined();
    }
  });

  it('genre가 undefined이면 에러를 반환한다', () => {
    const result = LessonRegisterSchema.safeParse({ ...validInput, genre: undefined });
    expect(result.success).toBe(false);
    if (!result.success) {
      const genreError = result.error.issues.find((issue) => issue.path[0] === 'genre');
      expect(genreError).toBeDefined();
    }
  });

  it('REGIONS의 모든 value가 schema enum으로 유효하다', () => {
    for (const { value } of REGIONS) {
      const result = LessonRegisterSchema.safeParse({ ...validInput, region: value });
      expect(result.success).toBe(true);
    }
  });

  it('GENRES의 모든 value가 schema enum으로 유효하다', () => {
    for (const { value } of GENRES) {
      const result = LessonRegisterSchema.safeParse({ ...validInput, genre: value });
      expect(result.success).toBe(true);
    }
  });
});
```

- [ ] **Step 3: 테스트 실행**

Run: `pnpm --filter=@mulink/web test -- lesson-register.schema`
Expected: 6 tests PASS

- [ ] **Step 4: 커밋**

```bash
git add apps/web/src/features/lesson-register/lesson-register.schema.ts apps/web/src/features/lesson-register/lesson-register.schema.test.ts
git commit -m "feat(web): add lesson-register zod schema"
```

---

## Task 2: 서버 액션 + 테스트

**Files:**
- Create: `apps/web/src/features/lesson-register/lesson-register.action.ts`
- Test: `apps/web/src/features/lesson-register/lesson-register.action.test.ts`

coach-register.action.ts와 동일 패턴이지만 **redirect 없음** — 성공 시 void 반환(클라이언트가 SuccessView로 전환).

- [ ] **Step 1: 액션 작성**

`apps/web/src/features/lesson-register/lesson-register.action.ts`:

```ts
'use server';

import { createClient } from '@/shared/lib/supabase/server';
import type { LessonRegisterFormType } from './lesson-register.schema';

export async function lessonRegisterAction(
  data: LessonRegisterFormType,
): Promise<{ error: string } | void> {
  const supabase = await createClient();
  // getSession은 쿠키 기반 세션을 그대로 읽으며 서버 재검증 없음
  // Bearer 토큰을 백엔드에 전달해야 하는 구조상 getUser() 대신 사용
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    return { error: '로그인이 필요합니다.' };
  }

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/lesson-requests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    return { error: body.message ?? '레슨 신청에 실패했습니다.' };
  }

  // 성공: redirect 없이 반환 → 클라이언트가 SuccessView로 전환
}
```

- [ ] **Step 2: 테스트 작성**

`apps/web/src/features/lesson-register/lesson-register.action.test.ts`:

```ts
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/shared/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

global.fetch = vi.fn();

import { lessonRegisterAction } from './lesson-register.action';
import { createClient } from '@/shared/lib/supabase/server';

const mockFormData = { region: 'SEOUL', genre: 'POP', goal: '음치 탈출' } as const;

describe('lessonRegisterAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('세션 없으면 로그인 필요 에러를 반환한다', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      },
    } as never);

    const result = await lessonRegisterAction(mockFormData);

    expect(result).toEqual({ error: '로그인이 필요합니다.' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fetch 실패 시 body의 message를 에러로 반환한다', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: 'test-token' } },
        }),
      },
    } as never);
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: vi.fn().mockResolvedValue({ message: '이미 레슨 신청 내역이 있습니다.' }),
    } as never);

    const result = await lessonRegisterAction(mockFormData);

    expect(result).toEqual({ error: '이미 레슨 신청 내역이 있습니다.' });
  });

  it('fetch 실패하고 body에 message 없으면 기본 에러 메시지를 반환한다', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: 'test-token' } },
        }),
      },
    } as never);
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: vi.fn().mockResolvedValue({}),
    } as never);

    const result = await lessonRegisterAction(mockFormData);

    expect(result).toEqual({ error: '레슨 신청에 실패했습니다.' });
  });

  it('fetch 성공 시 에러 없이(undefined) 반환한다', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: 'test-token' } },
        }),
      },
    } as never);
    vi.mocked(fetch).mockResolvedValue({ ok: true } as never);

    const result = await lessonRegisterAction(mockFormData);

    expect(result).toBeUndefined();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/lesson-requests'),
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
```

- [ ] **Step 3: 테스트 실행**

Run: `pnpm --filter=@mulink/web test -- lesson-register.action`
Expected: 4 tests PASS

- [ ] **Step 4: 커밋**

```bash
git add apps/web/src/features/lesson-register/lesson-register.action.ts apps/web/src/features/lesson-register/lesson-register.action.test.ts
git commit -m "feat(web): add lessonRegisterAction server action"
```

---

## Task 3: SuccessView

**Files:**
- Create: `apps/web/src/features/lesson-register/ui/SuccessView.tsx`

제출 성공 화면. props로 받은 region/genre value를 label로 매핑해 요약 카드에 표시. "현황 보러가기"는 `next/link` Link, `href="#"`.

- [ ] **Step 1: 컴포넌트 작성**

`apps/web/src/features/lesson-register/ui/SuccessView.tsx`:

```tsx
import Link from 'next/link';
import { Check, ArrowRight } from 'lucide-react';
import { REGIONS, GENRES, type RegionValue, type GenreValue } from '../lesson-register.schema';

type SuccessViewProps = {
  region: RegionValue;
  genre: GenreValue;
};

export function SuccessView({ region, genre }: SuccessViewProps) {
  const regionLabel = REGIONS.find((item) => item.value === region)?.label ?? region;
  const genreLabel = GENRES.find((item) => item.value === genre)?.label ?? genre;

  return (
    <div className="flex w-full max-w-130 flex-col gap-7">
      <div className="flex size-16 items-center justify-center rounded-full bg-(--green-100)">
        <Check className="size-7 text-(--green-600)" strokeWidth={2.5} />
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-extrabold tracking-tight text-(--green-800)">
          신청이 완료됐어요!
        </h2>
        <p className="text-sm leading-relaxed text-(--neutral-500)">
          AI가 나에게 맞는 코치를 찾고 있어요.
          <br />
          잠시 후 매칭 결과를 알려드릴게요.
        </p>
      </div>

      <div className="flex flex-col gap-3.5 rounded-lg bg-(--neutral-50) px-5 py-5">
        <SummaryRow label="지역" value={regionLabel} />
        <SummaryRow label="선호 장르" value={genreLabel} />
      </div>

      <Link
        href="#"
        className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-(--green-700) hover:text-(--green-800)"
      >
        현황 보러가기
        <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-xs font-medium text-(--neutral-400)">{label}</span>
      <span className="text-right text-sm font-medium text-(--neutral-800)">{value}</span>
    </div>
  );
}
```

- [ ] **Step 2: 타입체크**

Run: `cd apps/web && npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add apps/web/src/features/lesson-register/ui/SuccessView.tsx
git commit -m "feat(web): add lesson-register SuccessView"
```

---

## Task 4: SidePanel (스텝 활성화)

**Files:**
- Create: `apps/web/src/features/lesson-register/ui/SidePanel.tsx`

좌측 브랜드 패널. `useWatch`로 폼 값 구독해 스텝 활성화. 모바일에서는 로고+짧은 태그라인만 노출(웨이브폼/카피/스텝 숨김 — `hidden sm:flex`).

- [ ] **Step 1: 컴포넌트 작성**

`apps/web/src/features/lesson-register/ui/SidePanel.tsx`:

```tsx
'use client';

import { useWatch, type Control } from 'react-hook-form';
import { Mic, Check } from 'lucide-react';
import type { LessonRegisterFormType } from '../lesson-register.schema';

const WAVE_HEIGHTS = [10, 20, 30, 14, 38, 24, 32, 14, 28, 18, 12, 34, 22, 14, 28, 18, 22];
const STEPS = ['지역 선택', '선호 장르', '레슨 목표'];

type SidePanelProps = {
  control: Control<LessonRegisterFormType>;
};

export function SidePanel({ control }: SidePanelProps) {
  const [region, genre, goal] = useWatch({
    control,
    name: ['region', 'genre', 'goal'],
  });

  const stepDone = [Boolean(region), Boolean(genre), Boolean(goal?.trim())];

  return (
    <aside className="flex shrink-0 flex-col justify-between bg-(--green-800) px-6 py-5 sm:h-screen sm:w-65 sm:px-7 sm:py-11 lg:w-105 lg:px-13 lg:py-15 lg:sticky lg:top-0">
      {/* 로고 */}
      <div className="flex items-center gap-2">
        <Mic className="size-5.5 text-white" strokeWidth={2} />
        <span className="text-base font-extrabold tracking-tight text-white">MU:LINK</span>
        <span className="ml-2 text-xs font-normal text-white/50 sm:hidden">· 보컬 코치 매칭</span>
      </div>

      {/* 중앙 카피 — 모바일 숨김 */}
      <div className="hidden sm:block">
        <div className="mb-7 flex h-11 items-end gap-1">
          {WAVE_HEIGHTS.map((height, index) => (
            <div
              key={index}
              className="w-1 rounded-full bg-(--green-400) opacity-65"
              style={{ height }}
            />
          ))}
        </div>
        <h2 className="mb-3.5 text-[26px] font-extrabold leading-tight tracking-tighter break-keep text-white">
          나에게 맞는
          <br />
          보컬 코치 찾기
        </h2>
        <p className="text-sm leading-relaxed break-keep text-white/60">
          몇 가지 정보만 입력하면
          <br />
          AI가 최적의 코치를 매칭해 드려요.
        </p>
      </div>

      {/* 스텝 리스트 — 모바일 숨김 */}
      <div className="hidden flex-col gap-3 sm:flex">
        {STEPS.map((step, index) => {
          const done = stepDone[index];
          return (
            <div key={step} className="flex items-center gap-2.5">
              <div
                className={`flex size-5.5 shrink-0 items-center justify-center rounded-full border transition-colors duration-200 ${
                  done
                    ? 'border-(--green-300) bg-(--green-300)/20'
                    : 'border-white/20 bg-white/10'
                }`}
              >
                {done ? (
                  <Check className="size-3 text-(--green-300)" strokeWidth={3} />
                ) : (
                  <span className="font-mono text-[10px] font-bold text-white/55">{index + 1}</span>
                )}
              </div>
              <span
                className={`text-sm transition-colors duration-200 ${
                  done ? 'text-white' : 'text-white/55'
                }`}
              >
                {step}
              </span>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
```

> 웨이브폼 막대 높이는 동적 픽셀 값이라 Tailwind 임의값으로 풀어쓰기 번거로워 `style={{ height }}`만 예외적으로 사용(색/기타는 토큰 클래스). 시안과 동일.

- [ ] **Step 2: 타입체크**

Run: `cd apps/web && npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add apps/web/src/features/lesson-register/ui/SidePanel.tsx
git commit -m "feat(web): add lesson-register SidePanel with step activation"
```

---

## Task 5: LessonRegisterForm (컨테이너 겸 우측 폼)

**Files:**
- Create: `apps/web/src/features/lesson-register/ui/LessonRegisterForm.tsx`

`useForm` 소유 + 2단 레이아웃 + 우측 입력 필드(장르 칩 인라인) + 성공/입력 전환.

- [ ] **Step 1: 컴포넌트 작성**

`apps/web/src/features/lesson-register/ui/LessonRegisterForm.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useForm, useController } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MapPin, Music, Target, ArrowRight } from 'lucide-react';
import { Button } from '@/shared/ui/button/button';
import { Textarea } from '@/shared/ui/textarea/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select/select';
import {
  LessonRegisterSchema,
  REGIONS,
  GENRES,
  type LessonRegisterFormType,
} from '../lesson-register.schema';
import { lessonRegisterAction } from '../lesson-register.action';
import { SidePanel } from './SidePanel';
import { SuccessView } from './SuccessView';

export function LessonRegisterForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<LessonRegisterFormType | null>(null);

  const { register, control, handleSubmit, formState } = useForm<LessonRegisterFormType>({
    resolver: zodResolver(LessonRegisterSchema),
    defaultValues: {
      region: undefined,
      genre: undefined,
      goal: '',
    },
  });

  const { errors, isSubmitting } = formState;

  const { field: regionField } = useController({ name: 'region', control });
  const { field: genreField } = useController({ name: 'genre', control });

  const onSubmit = handleSubmit(async (data) => {
    setServerError(null);
    const result = await lessonRegisterAction(data);
    if (result?.error) {
      setServerError(result.error);
      return;
    }
    setSubmitted(data);
  });

  return (
    <div className="flex min-h-screen flex-col sm:flex-row">
      <SidePanel control={control} />

      <main className="flex flex-1 flex-col justify-start overflow-y-auto bg-white px-5 py-7 sm:justify-center sm:px-10 sm:py-11 lg:px-22 lg:py-16">
        {submitted ? (
          <div className="mx-auto flex w-full max-w-130 flex-1 flex-col justify-center">
            <SuccessView region={submitted.region} genre={submitted.genre} />
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            noValidate
            className="mx-auto flex w-full max-w-130 flex-col"
          >
            {serverError ? (
              <div
                role="alert"
                className="mb-5 rounded-md bg-(--danger-100) px-4 py-3 text-sm text-destructive"
              >
                {serverError}
              </div>
            ) : null}

            {/* 헤딩 */}
            <div className="mb-8">
              <span className="mb-3.5 inline-flex items-center rounded-full bg-(--green-100) px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-(--green-700)">
                LESSON APPLY
              </span>
              <h1 className="mb-1.5 text-2xl font-extrabold tracking-tight text-(--green-800)">
                신청서 작성
              </h1>
              <p className="text-sm text-(--neutral-500)">
                3분이면 충분해요. 아래 항목을 입력해 주세요.
              </p>
            </div>

            <div className="flex flex-col gap-6">
              {/* 지역 */}
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="region"
                  className="flex items-center gap-1.5 text-[13px] font-semibold text-(--neutral-700)"
                >
                  <MapPin className="size-3.5 text-(--green-600)" />
                  지역
                </label>
                <Select value={regionField.value ?? undefined} onValueChange={regionField.onChange}>
                  <SelectTrigger
                    id="region"
                    className="w-full"
                    aria-invalid={errors.region ? 'true' : undefined}
                  >
                    <SelectValue placeholder="지역을 선택해 주세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {REGIONS.map((region) => (
                      <SelectItem key={region.value} value={region.value}>
                        {region.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.region ? (
                  <p role="alert" className="text-xs text-destructive">
                    {errors.region.message}
                  </p>
                ) : null}
              </div>

              {/* 선호 장르 (단일 선택 칩) */}
              <div className="flex flex-col gap-2">
                <span className="flex items-center gap-1.5 text-[13px] font-semibold text-(--neutral-700)">
                  <Music className="size-3.5 text-(--green-600)" />
                  선호 장르
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {GENRES.map((genre) => {
                    const selected = genreField.value === genre.value;
                    return (
                      <button
                        key={genre.value}
                        type="button"
                        onClick={() => genreField.onChange(genre.value)}
                        className={`rounded-full border px-4 py-2 text-sm leading-none transition-colors duration-150 ${
                          selected
                            ? 'border-(--green-800) bg-(--green-800) font-semibold text-white'
                            : 'border-(--neutral-200) bg-white text-(--neutral-600) hover:border-(--green-400) hover:bg-(--green-50) hover:text-(--green-700)'
                        }`}
                      >
                        {genre.label}
                      </button>
                    );
                  })}
                </div>
                {errors.genre ? (
                  <p role="alert" className="text-xs text-destructive">
                    {errors.genre.message}
                  </p>
                ) : null}
              </div>

              {/* 레슨 목표 */}
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="goal"
                  className="flex items-center gap-1.5 text-[13px] font-semibold text-(--neutral-700)"
                >
                  <Target className="size-3.5 text-(--green-600)" />
                  레슨 목표
                </label>
                <Textarea
                  id="goal"
                  rows={4}
                  placeholder="예: 음치 탈출, 가수 오디션 준비, 취미로 노래 즐기기..."
                  aria-invalid={errors.goal ? 'true' : undefined}
                  {...register('goal')}
                />
                {errors.goal ? (
                  <p role="alert" className="text-xs text-destructive">
                    {errors.goal.message}
                  </p>
                ) : null}
              </div>
            </div>

            {/* CTA */}
            <div className="mt-7">
              <Button
                type="submit"
                variant="emphasis"
                size="lg"
                loading={isSubmitting}
                rightIcon={<ArrowRight className="size-4.5" />}
                className="w-full rounded-full"
              >
                코치 매칭 받기
              </Button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
```

> 칩은 `function`/컴포넌트로 분리하지 않고 `.map` 인라인으로 렌더(사용자 요청 + vercel `rerender-no-inline-components` 위배 방지). 조건부는 `&&` 대신 삼항(`rendering-conditional-render`). 훅은 직접 임포트(CS-1), map 콜백은 풀네임(CS-2).

- [ ] **Step 2: 타입체크**

Run: `cd apps/web && npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add apps/web/src/features/lesson-register/ui/LessonRegisterForm.tsx
git commit -m "feat(web): add LessonRegisterForm with single-select genre chips"
```

---

## Task 6: 페이지 가드 + 연결

**Files:**
- Modify: `apps/web/src/app/lesson/register/page.tsx`

기존 플레이스홀더(`<div>Lesson Register page</div>`)를 가드 + 폼으로 교체. coach/register/page.tsx 가드 패턴.

- [ ] **Step 1: 페이지 교체**

`apps/web/src/app/lesson/register/page.tsx` 전체 내용:

```tsx
import { redirect } from 'next/navigation';
import { LessonRegisterForm } from '@/features/lesson-register/ui/LessonRegisterForm';
import { getCurrentUser } from '@/entities/user/user.api';

export default async function LessonRegisterPage() {
  const user = await getCurrentUser();

  // 비로그인 상태인 경우
  if (!user) {
    return redirect('/');
  }

  // 학생이 아닌 경우(코치/관리자)
  if (user.role !== 'STUDENT') {
    return redirect('/');
  }

  return <LessonRegisterForm />;
}
```

- [ ] **Step 2: 타입체크 + lint**

Run: `cd apps/web && npx tsc --noEmit && pnpm --filter=@mulink/web lint`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add apps/web/src/app/lesson/register/page.tsx
git commit -m "feat(web): wire lesson register page with auth guard"
```

---

## Task 7: 전체 검증 (수동 + 자동)

- [ ] **Step 1: 전체 단위 테스트**

Run: `pnpm --filter=@mulink/web test`
Expected: 신규 schema/action 테스트 포함 전체 PASS

- [ ] **Step 2: 타입체크 + lint 전체**

Run: `cd apps/web && npx tsc --noEmit && pnpm --filter=@mulink/web lint`
Expected: 에러 없음

- [ ] **Step 3: 개발 서버 수동 검증**

Run: `pnpm turbo dev --filter=@mulink/web`

다음을 확인:
1. 미로그인 / COACH·ADMIN 계정 → `/lesson/register` 접근 시 `/` 리다이렉트
2. STUDENT 계정 빈값 제출 → 3개 필드 인라인 에러
3. 지역→장르→목표 입력하며 좌측 스텝이 순서대로 체크 활성화 (태블릿+ 뷰포트)
4. 정상 제출 → API 성공 → SuccessView(요약 카드: 지역/선호 장르) 표시
5. "현황 보러가기" 링크 `href="#"` 렌더링
6. 이미 신청 내역 있는 계정 제출 → 409 메시지(`이미 레슨 신청 내역이 있습니다.`) 폼 상단 표시
7. 모바일(<640px) / 태블릿(640–1023px) / 데스크탑(≥1024px) 레이아웃 확인 (모바일은 SidePanel 축소·스텝 숨김)

- [ ] **Step 4: 최종 커밋(있으면)**

수동 검증 중 수정 발생 시에만 커밋.

---

## Notes / 주의사항

- **Next.js 16**: 코드 작성 전 `apps/web/node_modules/next/dist/docs/`에서 관련 문서 확인(AGENTS.md 지시). 특히 `redirect` / Link / 서버-클라이언트 컴포넌트 경계.
- **shared/ui 확인**: `select`, `textarea`, `button`은 이미 존재. 새 공용 컴포넌트 추가 금지(요청 시 사용자 확인).
- **백엔드 무수정**: API/DTO/서비스는 건드리지 않는다(정합성은 프론트에서 맞춤).
- **role 타입**: `user.role`은 STUDENT/COACH/ADMIN 문자열(coach/register/page.tsx와 동일 사용).
- 디자인 시안의 픽셀값(예: `max-w-130`=520px, `w-65`=260px, `w-105`=420px)은 Tailwind 임의값으로 근사. 실제 렌더 확인 후 미세조정 가능.
