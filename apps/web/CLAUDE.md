@AGENTS.md

## 아키텍처

Feature-Sliced Design (FSD). 레이어 임포트는 `app → widgets → features → entities → shared` 단방향만 허용.

```
src/
├── app/       # Next.js App Router (라우팅, 레이아웃)
├── widgets/   # 도메인 안 타는 공통 조립 컴포넌트 (Header 등)
├── features/  # 사용자 행동 단위. UI + .action.ts(mutation) + .schema.ts
├── entities/  # 도메인 데이터. .api.ts(조회) + .type.ts 만 (UI 없음)
└── shared/    # 도메인 무관 순수 UI(shadcn) + lib
```

**배치 규칙 (헷갈리면 이 순서로 판단):**
- `features`/`entities` 하위 slice 폴더명은 도메인명으로 짓는다 (예: `lesson-request`, `coach-profile`).
- **UI 컴포넌트** — 무조건 `features/[기능]/ui/`. 도메인 안 타는 공통 조립물만 `widgets`, 순수 UI는 `shared/ui`.
- **데이터 변경(POST/DELETE/PATCH)** — `features`의 `.action.ts` (Next.js Server Action).
- **데이터 조회(GET) · 도메인 타입** — `entities/[도메인]`의 `.api.ts` / `.type.ts`.
- 한 줄 요약: **UI·변경은 features, 조회·타입 재료는 entities.**


서버 컴포넌트 기본, `'use client'`는 인터랙티브에만 사용.


## 코딩 컨벤션

### 작업 원칙

- **요청 이상 구현 금지** — "시니어 엔지니어가 보면 과하다 할까?" 자문
- **모호하면 묻기** — 해석이 여러 가지면 나열해서 확인, 혼자 선택 금지
- **shared/ui 우선** — 새 컴포넌트 작성 전 `src/shared/ui/`에 적합한 것 있는지 확인. 없으면 shadcn/ui 기준으로 추가할지 사용자에게 먼저 확인
- **스타일링**: `style` 속성 대신 Tailwind 클래스 사용
- **디자인 시스템 우선 사용** - 스타일 작업 시 `src/app/globals.css`에 정의된 MU:LINK 디자인 토큰(`--primary`, `--green-*`, `--radius-*`, `--shadow-*` 등)을 우선 사용한다.
- **Tailwind canonical 문법**: CSS 변수는 `text-(--neutral-700)` shorthand로, 스케일 값은 `size-9.5`처럼 canonical 클래스로 쓴다. `text-[var(--neutral-700)]`·`size-[38px]` 같은 임의값 문법 대신.
- **네이밍**: 역할이 즉시 파악되는 명확한 이름

### 파일 네이밍

비컴포넌트 파일은 `도메인.역할.ts` 형식. 역할 접미사로 파일 성격을 구분한다.

| 파일 | 역할 |
|---|---|
| `도메인.action.ts` | 서버 액션 (mutation) |
| `도메인.type.ts` | 타입 |
| `도메인.api.ts` | 데이터 페칭 |
| `도메인.schema.ts` | zod 스키마 (+ `z.infer`로 추출한 타입) |

### 심볼 네이밍

| 대상 | 규칙 | 예시 |
|---|---|---|
| 컴포넌트 | PascalCase | `ProposalCard` |
| Zod 스키마 | `PascalSchema` | `CoachRegisterSchema` |
| Zod 스키마 추론 타입 | `PascalType` (폼이면 `PascalFormType`) | `CoachRegisterFormType` |
| 서버 액션 함수 | `동사~Action` (create/delete/update) | `createLessonRequestAction`, `deleteLessonRequestAction` |
| 조회 api 함수 | `get~` | `getMyLessonRequest` |


