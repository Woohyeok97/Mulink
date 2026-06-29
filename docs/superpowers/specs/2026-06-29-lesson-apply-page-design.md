# Lesson Apply Page — Design Spec

**날짜**: 2026-06-29
**작업자**: Woohyeok Baek

---

## Context

학생이 레슨을 신청하는 페이지(`/lesson/register`)를 구현한다. 백엔드 `POST /lesson-requests` API는 이미 완성된 상태(`apps/api/src/lesson/lesson.controller.ts`)이고, Claude Design 시안(`Lesson Apply B.html`)을 바탕으로 프론트엔드를 연결하는 작업이다.

기존 `features/coach-register/` 패턴(schema / action / ui + 각 테스트)을 그대로 미러링한다. 디자인 시안의 외형은 따르되, 스타일은 `apps/web/src/app/globals.css`의 MU:LINK 디자인 토큰과 `shared/ui` 공용 컴포넌트를 우선시한다.

현재 `app/lesson/register/page.tsx`는 플레이스홀더(`<div>Lesson Register page</div>`)만 있는 상태이며, 이를 실제 페이지로 대체한다.

---

## 디자인 시안 요약 (Lesson Apply B.html)

2단 레이아웃: 좌측 브랜드 패널(`--green-800` 배경) + 우측 폼 패널(흰 배경).

**좌측 브랜드 패널**
- 상단: 로고(마이크 아이콘 + `MU:LINK`)
- 중앙: 웨이브폼 막대 + 카피("나에게 맞는 보컬 코치 찾기")
- 하단: **스텝 리스트 3개** (1 지역 선택 / 2 선호 장르 / 3 레슨 목표) — 아래 "스텝 활성화" 참고

**우측 폼 패널**
- 헤딩: `LESSON APPLY` 뱃지 + "신청서 작성" + 부제
- 필드 3개: 지역(select), 선호 장르(칩), 레슨 목표(textarea)
- CTA: "코치 매칭 받기" 버튼(우측 화살표 아이콘, full-width, pill)
- 제출 성공 시 같은 패널 자리에 성공 화면(SuccessView) 표시

---

## API 정합성 결정사항

디자인 시안과 백엔드 API가 일부 어긋나 있어, **API 기준으로 맞춘다**(백엔드 무수정).

| 항목 | 디자인 시안 | 결정 (API 기준) |
|------|-------------|------------------|
| 선호 장르 | 다중 선택(배열) | **단일 선택** — 칩 UI는 유지하되 하나만 선택 (`genre: Genre`) |
| 레슨 목표 | 선택 사항 | **필수** — zod `min(1)` 검증 (서비스가 `goal` 필수 검증함) |
| 지역 목록 | 10개(강원/제주 포함) | **API enum 8개** — SEOUL, GYEONGGI, INCHEON, BUSAN, DAEGU, ULSAN, GWANGJU, DAEJEON |
| 제출 후 | SuccessView 화면 | **SuccessView 유지** — 단 "예상 매칭 시간 3분" 등 더미는 제거/단순화 |

→ 결과적으로 **3개 필드 모두 필수**다.

---

## 스텝 활성화 (사용자 요청 추가 사항)

좌측 브랜드 패널의 스텝 리스트가 우측 폼 입력 상태에 **실시간 반응**한다.

- 지역 선택됨 → 1번 스텝(지역 선택) 활성
- 장르 선택됨 → 2번 스텝(선호 장르) 활성
- 레슨 목표 입력됨(trim 후 비어있지 않음) → 3번 스텝(레슨 목표) 활성

**시각 표현**
- 비활성: 디자인 기본값(반투명 흰색 텍스트, 흐린 원형 번호)
- 활성: 번호 자리에 체크 아이콘 + 더 밝은 텍스트/테두리(`--green-300`/흰색 계열), 부드러운 전환(`--dur-base`)

**구조적 함의 (중요)**

스텝 활성화가 폼 값(region/genre/goal)에 반응해야 하므로 좌측 패널과 우측 폼이 같은 상태를 공유해야 한다. 해결책:

- 레이아웃 컨테이너(클라이언트 컴포넌트)가 `useForm`을 소유한다.
- 컨테이너가 `FormProvider`로 form context를 제공하고, 그 아래 `BrandPanel`과 `LessonRegisterForm`이 같은 context를 공유한다.
- `BrandPanel`은 `useWatch`(또는 `useFormContext` + `useWatch`)로 region/genre/goal만 구독해 스텝 활성 상태를 계산한다.
- `useWatch`를 쓰면 폼 전체가 아닌 구독한 값 변경 시에만 해당 부분이 리렌더된다 (vercel `rerender-defer-reads` 부합).

---

## 아키텍처

### 파일 구조 (coach-register 패턴 미러링)

```
apps/web/src/
├── app/lesson/register/
│   └── page.tsx                          # 서버 컴포넌트. 인증/role 가드 + 컨테이너 렌더링
└── features/lesson-register/
    ├── lesson-register.schema.ts         # zod 스키마 (REGIONS, GENRES, 타입)
    ├── lesson-register.schema.test.ts
    ├── lesson-register.action.ts         # 'use server' POST /lesson-requests
    ├── lesson-register.action.test.ts
    └── ui/
        ├── LessonRegisterForm.tsx        # 'use client' useForm 소유 + 2단 레이아웃 + 우측 필드 폼 + 장르 칩(인라인) + 성공/입력 전환
        ├── SidePanel.tsx                 # 좌측 패널 (스텝 활성화, useWatch 구독)
        └── SuccessView.tsx               # 제출 성공 화면
```

> `LessonRegisterForm`이 `useForm`을 소유하는 컨테이너 겸 우측 폼 역할을 한다. 스텝 활성화 때문에 `SidePanel`과 폼이 같은 form context를 공유해야 하므로, `LessonRegisterForm`이 `FormProvider`로 감싸고 그 안에 `SidePanel`과 우측 필드를 렌더링한다.
>
> 장르 칩은 별도 컴포넌트로 분리하지 않고 `LessonRegisterForm` 안에서 직접 렌더링한다(사용자 요청). 단 칩 버튼 자체는 인라인 `.map`으로 그리며, 컴포넌트를 컴포넌트 함수 본문 안에 새로 `function`/`const`로 정의하지는 않는다(vercel `rerender-no-inline-components` 위배 방지). `SuccessView`는 독립적 화면이라 별도 파일로 분리한다.

### 레이어 임포트 방향 준수

`app/lesson/register/page.tsx` → `features/lesson-register/ui/*` → `shared/ui/*`

---

## 인증 & 접근 제어

`page.tsx`는 서버 컴포넌트. coach-register 페이지 패턴을 따른다:

1. `getCurrentUser()`(`entities/user/user.api.ts`)로 유저 조회.
2. 미로그인(`!user`) → `redirect('/')`
3. STUDENT가 아니면(`user.role !== 'STUDENT'`) → `redirect('/')`
4. 통과 시 `LessonRegisterContainer` 렌더링.

> 중복 신청(이미 레슨 신청 내역 있음)은 API가 409(`ConflictException`)로 막으므로, 폼에서 그 메시지를 그대로 표시한다(서버 가드는 하지 않음 — coach-register와 동일 철학).

---

## 폼 스키마 (Zod) — `lesson-register.schema.ts`

coach-register.schema.ts와 동일한 작성 스타일(상수 배열 + `z.enum`).

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

export const GENRES = [
  { value: 'POP', label: '팝' },
  { value: 'BALLAD', label: '발라드' },
  { value: 'ROCK', label: '록' },
  { value: 'RNB', label: 'R&B' },
  { value: 'JAZZ', label: '재즈' },
  { value: 'HIPHOP', label: '힙합' },
  { value: 'TROT', label: '트로트' },
] as const;

export const LessonRegisterSchema = z.object({
  region: z.enum(regionValues, { error: '지역을 선택해 주세요.' }),
  genre: z.enum(genreValues, { error: '선호 장르를 선택해 주세요.' }),
  goal: z.string().min(1, '레슨 목표를 입력해 주세요.'),
});

export type LessonRegisterFormType = z.infer<typeof LessonRegisterSchema>;
```

label/value 분리는 enum 값(API 전송)과 한글 표시 라벨(UI)을 모두 가지기 위함이며 coach-register와 동일 패턴.

---

## 서버 액션 — `lesson-register.action.ts`

coach-register.action.ts를 그대로 미러링. **단, redirect 하지 않는다**(성공 화면 표시 결정 때문).

```ts
'use server';

export async function lessonRegisterAction(
  data: LessonRegisterFormType,
): Promise<{ error: string } | void> {
  // 1. Supabase 서버 클라이언트 → getSession()으로 access_token 획득
  // 2. 없으면 { error: '로그인이 필요합니다.' }
  // 3. fetch POST `${NEXT_PUBLIC_API_URL}/lesson-requests`
  //    headers: Authorization: Bearer <token>, body: JSON.stringify(data)
  // 4. !response.ok → { error: body.message ?? '레슨 신청에 실패했습니다.' }
  // 5. 성공 → return (void). redirect 없음 → 클라이언트가 성공 화면으로 전환
}
```

> coach-register는 성공 시 `redirect('/')` 하지만, 본 페이지는 성공 화면을 보여줘야 하므로 redirect를 제거한다.

---

## UI 컴포넌트 구성

### LessonRegisterForm (`'use client'`, 컨테이너 겸 우측 폼)

- `useForm<LessonRegisterFormType>({ resolver: zodResolver(...), defaultValues: { region: undefined, genre: undefined, goal: '' } })`
- `useState`로 성공 여부(`submitted`)와 서버 에러(`serverError`) 관리.
- `FormProvider`로 감싸 `SidePanel`과 우측 폼이 form context 공유.
- `onSubmit`: 액션 호출 → `result?.error`면 serverError 세팅, 아니면 `submitted=true`.
- 레이아웃: 좌측 `SidePanel` + 우측 패널(submitted 이면 `SuccessView`, 아니면 입력 필드들) — 디자인의 `.page` / `.brand-panel` / `.form-panel` 구조를 Tailwind로 재현.

우측 입력 필드:
- 지역: `shared/ui/select/select.tsx` + `useController`(name: 'region') — coach-register와 동일.
- 선호 장르: **이 파일 안에서 칩을 직접 `.map`으로 렌더링** + `useController`(name: 'genre'). 단일 선택 — 클릭 시 해당 value를 field에 set. 선택 칩: `--green-800` 배경 + 흰 텍스트, 미선택: 테두리 `--neutral-200`, hover: `--green-50` 등 디자인 톤 토큰화. (별도 컴포넌트로 빼지 않음 / 함수 본문 내 컴포넌트 정의도 하지 않음)
- 레슨 목표: `shared/ui/textarea/textarea.tsx` + `register('goal')`.
- 각 필드 에러는 `errors.<field>.message`를 인라인 표시.
- 제출 버튼: `shared/ui/button/button.tsx` (`variant`/`size`/`loading`/`rightIcon` 활용, full-width). 디자인의 pill 형태는 토큰/클래스로 맞춤.

### SidePanel

- 로고/웨이브폼/카피 + 스텝 리스트.
- `useWatch`로 region/genre/goal 구독 → 각 스텝 활성 상태 계산.
- 스텝 활성: 체크 아이콘 + 밝은 톤. 비활성: 디자인 기본 흐린 톤.

### SuccessView (별도 파일)

- 체크 아이콘 원형 + "신청이 완료됐어요!" + 안내 문구.
- 요약 카드: 지역/선호 장르 표시(label 매핑). **"예상 매칭 시간 3분" 더미는 제거.**
- **"현황 보러가기"** — 버튼이 아닌 `Link`(`next/link`) 태그. 현황 페이지가 아직 없으므로 `href="#"`로 둔다. (기존 "다시 작성하기" / reset 동작은 제거)

---

## 디자인 토큰 매핑 (시안 인라인 → globals.css)

시안은 `var(--green-800)` 등 토큰을 직접 쓰지만 `style` 인라인이다. 이를 Tailwind 클래스 + MU:LINK 토큰으로 변환(웹 CLAUDE.md: `style` 금지, 디자인 토큰 우선).

| 시안 인라인 | 변환 |
|-------------|------|
| `background: var(--green-800)` | `bg-(--green-800)` |
| 카드/입력 배경 `var(--neutral-50)` | `bg-(--neutral-50)` |
| 테두리 `var(--neutral-200)` | `border-(--neutral-200)` |
| radius 10 / 999 | `rounded-sm` / `rounded-full` |
| 전환 150ms ease-out | `transition` + `--dur-base`/`--ease-out` |
| 아이콘 | lucide-react (`Mic`, `MapPin`, `Music`, `Target`, `ArrowRight`, `Check`) |

---

## 반응형 (시안 미디어쿼리 재현, Tailwind 브레이크포인트)

| 뷰포트 | 레이아웃 |
|--------|---------|
| 모바일 < 640px | 세로 스택. 브랜드 패널 축소(로고+짧은 태그라인만, 웨이브폼/카피/스텝 숨김). 폼 풀폭. |
| 태블릿 640–899px (`sm`) | 좌우 2단. 브랜드 패널 좁게(~260px). |
| 데스크탑 ≥ 900px (사실상 `lg`로 근사) | 좌우 2단. 브랜드 패널 360–420px, sticky full-height. |

> 시안의 900/1200px 분기를 Tailwind 기본 브레이크포인트(`sm` 640 / `lg` 1024)로 근사 매핑한다. 모바일에서 스텝 리스트는 숨기므로 스텝 활성화는 태블릿+ 에서 의미를 가진다.

---

## 코드 스타일 (적용 스킬 준수)

- **frontend-code-style**
  - CS-1: 훅 직접 임포트 (`useState` 등, 시안의 `React.useState` 변환)
  - CS-2: map 콜백 풀네임 (`region`, `genre` — 시안의 `r`/`g`/`s` 금지)
  - CS-3: 각 파일 메인 컴포넌트 상단, 서브는 아래/별도 파일
- **vercel-react-best-practices**
  - `rerender-no-inline-components`: 모든 서브 컴포넌트 분리(시안은 인라인)
  - `rendering-conditional-render`: `&&` 대신 삼항 (시안의 `{!canSubmit && ...}` 등)
  - `rerender-functional-setstate`: 상태 갱신 시 함수형 setState
  - `rerender-defer-reads` / `useWatch`: 스텝 활성화는 구독한 값만 리렌더
  - 페이지는 서버 컴포넌트, 인터랙티브 컨테이너만 `'use client'`
- **react-hook-form**: 컨트롤이 필요한 select/장르 칩은 `useController` 사용.

---

## 에러 처리

| 상황 | 처리 |
|------|------|
| 지역 미선택 | zod 인라인 에러 |
| 장르 미선택 | zod 인라인 에러 |
| 레슨 목표 빈값 | zod 인라인 에러 |
| 이미 신청 내역 있음 (409) | API 메시지 폼 상단 표시 |
| 미로그인/토큰 만료 | API/액션 에러 메시지 표시 |
| 네트워크 오류 | 일반 에러 메시지 폼 상단 표시 |

---

## 검증 방법

1. `pnpm turbo dev --filter=@mulink/web` 으로 개발 서버 시작
2. 미로그인 상태에서 `/lesson/register` 접근 → 홈(`/`) 리다이렉트
3. COACH/ADMIN 계정 → 홈 리다이렉트
4. STUDENT 계정 로그인 후 빈값 제출 → 3개 필드 인라인 에러
5. 지역/장르/목표 입력하며 좌측 스텝이 순서대로 활성화되는지 확인 (태블릿+ 뷰포트)
6. 정상 값 제출 → API 성공 → SuccessView(요약 카드) 표시
7. SuccessView의 "현황 보러가기" 링크가 `href="#"`로 렌더링되는지 확인
8. 이미 신청 내역 있는 계정으로 제출 → 409 메시지 폼 상단 표시
9. 모바일/태블릿/데스크탑 3개 뷰포트 레이아웃 확인
10. 스키마/액션 단위 테스트: `pnpm --filter=@mulink/web test`(coach-register 테스트 패턴 따름)
