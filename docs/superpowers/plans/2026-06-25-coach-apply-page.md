# Coach Apply Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 코치 신청 페이지(`/coach/apply`)를 Claude Design 시안에 맞게 구현하고 백엔드 `POST /coaches` API에 연결한다.

**Architecture:** 서버 컴포넌트(`page.tsx`)가 Supabase 세션을 확인해 미로그인 시 홈으로 리다이렉트한다. 폼 로직은 `'use client'` 컴포넌트(`coachApplyForm.tsx`)가 담당하며, 서버 액션(`coach.action.ts`)이 토큰을 획득해 API를 호출한다. Zod 스키마는 별도 파일(`coachApplySchema.ts`)로 분리한다.

**Tech Stack:** Next.js 16 App Router, React 19, react-hook-form, zod, @hookform/resolvers, Supabase SSR, Tailwind CSS v4, lucide-react, shadcn/radix-ui

---

## 파일 구조

| 파일 | 역할 |
|------|------|
| `apps/web/src/features/coach/apply/coachApplySchema.ts` | Zod 스키마 + 타입 정의 |
| `apps/web/src/features/coach/apply/coach.action.ts` | 서버 액션: 토큰 획득 → API 호출 |
| `apps/web/src/features/coach/apply/coachApplyForm.tsx` | `'use client'` 폼 컴포넌트 |
| `apps/web/src/app/coach/apply/page.tsx` | 서버 컴포넌트: 인증 체크 + 폼 렌더링 |

---

## Task 1: Zod 스키마 파일 작성

**Files:**
- Create: `apps/web/src/features/coach/apply/coachApplySchema.ts`

- [ ] **Step 1: 파일 생성**

```ts
// apps/web/src/features/coach/apply/coachApplySchema.ts
import { z } from 'zod';

export const REGIONS = [
  { value: 'SEOUL', label: '서울' },
  { value: 'GYEONGGI', label: '경기' },
  { value: 'INCHEON', label: '인천' },
] as const;

export type RegionValue = (typeof REGIONS)[number]['value'];

export const coachApplySchema = z.object({
  activityName: z.string().min(1, '활동명을 입력해 주세요.'),
  region: z.enum(['SEOUL', 'GYEONGGI', 'INCHEON'], {
    required_error: '지역을 선택해 주세요.',
  }),
});

export type CoachApplyFormValues = z.infer<typeof coachApplySchema>;
```

- [ ] **Step 2: 타입체크 확인**

```bash
pnpm --filter=@mulink/web exec tsc --noEmit
```

기대 결과: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add apps/web/src/features/coach/apply/coachApplySchema.ts
git commit -m "feat(web): add coachApplySchema with zod"
```

---

## Task 2: 서버 액션 작성

**Files:**
- Create: `apps/web/src/features/coach/apply/coach.action.ts`

> 참고: `apps/web/src/features/auth/auth.action.ts` 패턴 그대로 따름

- [ ] **Step 1: 파일 생성**

```ts
// apps/web/src/features/coach/apply/coach.action.ts
'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/shared/lib/supabase/server';
import type { CoachApplyFormValues } from './coachApplySchema';

type ActionResult = { error: string } | never;

export async function registerCoachAction(data: CoachApplyFormValues): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  if (!token) {
    return { error: '로그인이 필요합니다.' };
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

  const res = await fetch(`${apiUrl}/coaches`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { error: body.message ?? '코치 가입에 실패했습니다.' };
  }

  redirect('/');
}
```

- [ ] **Step 2: 환경 변수 확인**

`apps/web/.env.local`에 `NEXT_PUBLIC_API_URL`이 있는지 확인한다. 없으면 기본값 `http://localhost:3001`이 사용된다.

- [ ] **Step 3: 타입체크 확인**

```bash
pnpm --filter=@mulink/web exec tsc --noEmit
```

기대 결과: 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add apps/web/src/features/coach/apply/coach.action.ts
git commit -m "feat(web): add registerCoachAction server action"
```

---

## Task 3: 폼 컴포넌트 작성

**Files:**
- Create: `apps/web/src/features/coach/apply/coachApplyForm.tsx`

> 참고 컴포넌트:
> - `apps/web/src/shared/ui/input/input.tsx` — `Input` (leftIcon prop 지원)
> - `apps/web/src/shared/ui/select/select.tsx` — `Select`, `SelectTrigger`, `SelectContent`, `SelectItem`, `SelectValue`
> - `apps/web/src/shared/ui/button/button.tsx` — `Button` (variant="emphasis", size="lg", loading prop)

- [ ] **Step 1: 파일 생성**

```tsx
// apps/web/src/features/coach/apply/coachApplyForm.tsx
'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mic2, MapPin, UserPlus } from 'lucide-react';

import { Input } from '@/shared/ui/input/input';
import { Button } from '@/shared/ui/button/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select/select';
import {
  coachApplySchema,
  REGIONS,
  type CoachApplyFormValues,
} from './coachApplySchema';
import { registerCoachAction } from './coach.action';

export function CoachApplyForm() {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CoachApplyFormValues>({
    resolver: zodResolver(coachApplySchema),
  });

  async function onSubmit(values: CoachApplyFormValues) {
    setServerError(null);
    const result = await registerCoachAction(values);
    if (result?.error) {
      setServerError(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="w-full">
      {/* 서버 에러 */}
      {serverError && (
        <div
          role="alert"
          className="mb-5 rounded-md bg-(--danger-100) px-4 py-3 text-sm text-(--danger-700)"
        >
          {serverError}
        </div>
      )}

      <div className="flex flex-col gap-3.5">
        {/* 활동명 */}
        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-1 text-sm font-semibold text-(--neutral-700)">
            <Mic2 className="size-3.5 text-(--green-600)" />
            활동명
          </label>
          <Input
            placeholder="활동명을 입력해 주세요"
            aria-invalid={errors.activityName ? 'true' : undefined}
            {...register('activityName')}
          />
          {errors.activityName && (
            <p className="text-xs text-destructive">{errors.activityName.message}</p>
          )}
        </div>

        {/* 활동 지역 */}
        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-1 text-sm font-semibold text-(--neutral-700)">
            <MapPin className="size-3.5 text-(--green-600)" />
            활동 지역
          </label>
          <Controller
            name="region"
            control={control}
            render={({ field }) => (
              <Select value={field.value ?? ''} onValueChange={field.onChange}>
                <SelectTrigger
                  className="w-full"
                  aria-invalid={errors.region ? 'true' : undefined}
                >
                  <SelectValue placeholder="지역을 선택해 주세요" />
                </SelectTrigger>
                <SelectContent>
                  {REGIONS.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.region && (
            <p className="text-xs text-destructive">{errors.region.message}</p>
          )}
        </div>
      </div>

      {/* 제출 버튼 */}
      <div className="mt-6">
        <Button
          type="submit"
          variant="emphasis"
          size="lg"
          loading={isSubmitting}
          leftIcon={<UserPlus className="size-[18px]" />}
          className="w-full"
        >
          코치 가입하기
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: 타입체크 확인**

```bash
pnpm --filter=@mulink/web exec tsc --noEmit
```

기대 결과: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add apps/web/src/features/coach/apply/coachApplyForm.tsx
git commit -m "feat(web): add CoachApplyForm component"
```

---

## Task 4: 페이지 컴포넌트 작성

**Files:**
- Modify: `apps/web/src/app/coach/apply/page.tsx`

> 디자인 시안: 민트 그라디언트 배경 + 우상단/좌하단 blur blob + 600px↑에서 glassmorphism 카드

- [ ] **Step 1: 파일 교체**

```tsx
// apps/web/src/app/coach/apply/page.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/shared/lib/supabase/server';
import { CoachApplyForm } from '@/features/coach/apply/coachApplyForm';
import { Mic } from 'lucide-react';

export default async function CoachApplyPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect('/');
  }

  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-10 sm:py-16"
      style={{
        background:
          'linear-gradient(150deg, var(--green-50) 0%, var(--green-100) 55%, var(--green-200) 100%)',
      }}
    >
      {/* 장식 blob */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-[12%] -right-[12%] h-[480px] w-[480px] rounded-full opacity-55"
        style={{ background: 'var(--sand-100)', filter: 'blur(72px)' }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-[8%] -left-[10%] h-[360px] w-[360px] rounded-full opacity-40"
        style={{ background: 'var(--green-300)', filter: 'blur(72px)' }}
      />

      {/* 컨텐츠 */}
      <div className="relative z-10 flex w-full max-w-[400px] flex-col items-center sm:rounded-[var(--radius-2xl)] sm:border sm:border-white/60 sm:bg-white/82 sm:px-12 sm:py-14 sm:shadow-[var(--shadow-xl)] sm:[backdrop-filter:blur(16px)]">

        {/* 로고 */}
        <div className="mb-12 flex items-center gap-2">
          <Mic className="size-7 stroke-[var(--green-700)] stroke-2" />
          <span
            className="text-xl font-extrabold tracking-tight leading-none"
            style={{ color: 'var(--green-800)' }}
          >
            MU:LINK
          </span>
        </div>

        {/* 헤드라인 */}
        <div className="mb-10 text-center">
          <h1
            className="mb-3 text-2xl font-extrabold leading-tight tracking-tighter break-keep"
            style={{ color: 'var(--green-800)' }}
          >
            당신의 목소리로<br />코치가 되다
          </h1>
          <p className="break-keep text-base leading-normal" style={{ color: 'var(--neutral-500)' }}>
            MU:LINK 코치로 등록하고<br />나에게 맞는 수강생을 만나 보세요.
          </p>
        </div>

        {/* 폼 */}
        <CoachApplyForm />

      </div>
    </div>
  );
}
```

- [ ] **Step 2: 타입체크 확인**

```bash
pnpm --filter=@mulink/web exec tsc --noEmit
```

기대 결과: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add apps/web/src/app/coach/apply/page.tsx
git commit -m "feat(web): implement coach apply page with design system"
```

---

## Task 5: 통합 검증

- [ ] **Step 1: 개발 서버 시작**

```bash
pnpm turbo dev --filter=@mulink/web
```

기대 결과: `http://localhost:3000` 에서 서버 시작

- [ ] **Step 2: 미로그인 접근 확인**

브라우저에서 `http://localhost:3000/coach/apply` 접근.
기대 결과: 홈(`/`)으로 리다이렉트

- [ ] **Step 3: 레이아웃 확인**

STUDENT 계정으로 로그인 후 `/coach/apply` 접근.
- 모바일(< 600px): 배경만, 카드 없음
- 데스크탑(≥ 600px): glassmorphism 카드 + mint 배경

- [ ] **Step 4: 폼 유효성 검사 확인**

빈 상태에서 "코치 가입하기" 클릭.
기대 결과:
- 활동명 아래 "활동명을 입력해 주세요." 표시
- 지역 아래 "지역을 선택해 주세요." 표시

- [ ] **Step 5: 정상 제출 확인**

활동명과 지역을 입력 후 제출.
기대 결과: API 호출 성공 → 홈(`/`)으로 리다이렉트

- [ ] **Step 6: 에러 케이스 확인**

이미 COACH인 계정으로 시도 (또는 API 직접 호출로 409 응답 시뮬레이션).
기대 결과: 폼 상단에 "이미 코치로 등록된 계정입니다." 표시
