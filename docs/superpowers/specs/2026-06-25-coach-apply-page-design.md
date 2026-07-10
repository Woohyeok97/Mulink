# Coach Apply Page — Design Spec

**날짜**: 2026-06-25  
**작업자**: Woohyeok Baek

---

## Context

코치 신청 페이지(`/coach/apply`)를 구현한다. 백엔드 `POST /coaches` API는 이미 완성된 상태이고, Claude Design 시안(`Coach Signup.html`)을 바탕으로 프론트엔드를 연결하는 작업이다.

---

## 디자인 시안 요약

- 무드: 민트 그라디언트 배경 (`#F1FAF3 → #E1F4E6 → #CFEDD5`)
- 레이아웃: 카드 (600px+ 뷰포트에서 glassmorphism 카드, 모바일에서는 full-width)
- 장식 blob 두 개 (우상단, 좌하단)
- 필드: 활동명(Input) + 활동 지역(Select) 단 2개
- CTA: "코치 가입하기" 버튼 (emphasis variant, full-width)

---

## 아키텍처

### 파일 구조

```
apps/web/src/
├── app/coach/apply/
│   └── page.tsx                    # 서버 컴포넌트. 인증 확인 + CoachApplyForm 렌더링
├── features/coach/apply/
│   ├── coach-apply-form.tsx        # 'use client' 폼 컴포넌트 (react-hook-form + zod)
│   └── coach.action.ts             # 서버 액션. Supabase 토큰 획득 → POST /coaches
```

### 레이어 임포트 방향 준수

`app/coach/apply/page.tsx` → `features/coach/apply/coach-apply-form.tsx` → `shared/ui/*`

---

## 인증 & 접근 제어

페이지(`page.tsx`)는 서버 컴포넌트로, 렌더링 시 두 가지를 확인한다:

1. **로그인 여부**: Supabase 서버 클라이언트(`createClient`)로 세션 확인. 미로그인 → `redirect('/')`
2. **role 확인 없음**: role(STUDENT/COACH/ADMIN) 판별은 서버에 맡김. 이미 COACH이거나 ADMIN이면 API가 409 에러를 반환하고, 폼에서 그 메시지를 그대로 표시함.

---

## 폼 스키마 (Zod)

```ts
const schema = z.object({
  activityName: z.string().min(1, '활동명을 입력해 주세요.'),
  region: z.enum(['SEOUL', 'GYEONGGI', 'INCHEON'], {
    required_error: '지역을 선택해 주세요.',
  }),
});
```

지역 선택지: 서울(SEOUL) / 경기(GYEONGGI) / 인천(INCHEON) — 백엔드 enum 기준.

---

## 서버 액션 (`coach.action.ts`)

```ts
'use server'

async function registerCoachAction(data: RegisterCoachInput): Promise<ActionResult>
```

1. Supabase 서버 클라이언트로 세션 토큰(`access_token`) 획득
2. `fetch('POST /coaches')` — `Authorization: Bearer <token>` 헤더 포함
3. 성공(201) → `redirect('/')`
4. 실패 → `{ error: string }` 반환 (HTTP 에러 메시지 그대로)

---

## UI 컴포넌트 구성

`CoachApplyForm`은 `'use client'` 클라이언트 컴포넌트.

- `shared/ui/input/input.tsx` — 활동명 입력
- `shared/ui/select/select.tsx` — 지역 선택 (SelectRoot/Trigger/Content/Item)
- `shared/ui/button/button.tsx` — 제출 버튼 (`variant="emphasis"`, `size="lg"`, `loading` prop)

디자인 토큰 (`globals.css`):
- 배경: `linear-gradient(150deg, var(--green-50) 0%, var(--green-100) 55%, var(--green-200) 100%)`
- 카드: `background: rgba(255,255,255,0.82)`, `backdrop-filter: blur(16px)`, `box-shadow: var(--shadow-xl)`
- Blob: `var(--sand-100)` (우상단), `var(--green-300)` (좌하단)

---

## 반응형

| 뷰포트 | 레이아웃 |
|--------|---------|
| < 600px | 배경만, 카드 없음, full-width 패딩 |
| ≥ 600px | glassmorphism 카드 (max-width: 400px, padding: 56px 48px) |

---

## 에러 처리

| 상황 | 처리 |
|------|------|
| 활동명 빈값 | zod 인라인 에러 메시지 |
| 지역 미선택 | zod 인라인 에러 메시지 |
| 이미 코치 (409) | API 에러 메시지 폼 상단 표시 |
| 어드민 계정 (409) | API 에러 메시지 폼 상단 표시 |
| 네트워크 오류 | 일반 에러 메시지 폼 상단 표시 |

---

## 검증 방법

1. `pnpm turbo dev --filter=@mulink/web` 으로 개발 서버 시작
2. 미로그인 상태에서 `/coach/apply` 접근 → 홈(`/`) 리다이렉트 확인
3. STUDENT 계정 로그인 후 폼 빈값 제출 → 인라인 에러 확인
4. 정상 값 입력 후 제출 → API 호출 성공 → 홈 리다이렉트 확인
5. 이미 COACH인 계정으로 접근 후 제출 → 409 에러 메시지 폼 상단 표시 확인
6. 모바일(< 600px) / 데스크탑(≥ 600px) 양쪽 레이아웃 확인
