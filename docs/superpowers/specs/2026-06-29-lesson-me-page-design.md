# Lesson Me (내 레슨 신청 현황) Page — Design Spec

**날짜**: 2026-06-29
**작업자**: Woohyeok Baek

---

## Context

학생이 자신이 신청한 레슨의 현황(신청 내용 요약 + 코치들의 레슨 제안 리스트)을 조회하는 페이지(`/lesson/me`)를 구현한다. 백엔드 GET API 2종은 이미 완성된 상태(`apps/api/src/lesson/lesson.controller.ts`):

- `GET /lesson-requests/me` — 내 레슨 신청 1건 조회
- `GET /lesson-requests/me/offers` — 내 신청에 달린 코치 제안 리스트 (현재 임시 Mock)

Claude Design 시안(`Lesson Proposals.html`, **레이아웃 A — Split Sidebar 대시보드**)을 바탕으로 프론트엔드를 연결한다. 이번 작업의 목적은 **GET 요청을 사용한 조회 화면 + 코치 프로필 드로어(뷰 전용)** 까지이며, **레슨 수락/매칭/삭제 같은 상태 변경 기능은 범위에서 제외**한다.

스타일은 `apps/web/src/app/globals.css`의 MU:LINK 디자인 토큰과 `shared/ui` 공용 컴포넌트(특히 `drawer`)를 우선시한다. 데이터 패칭은 기존 `entities/user/user.api.ts`(`getCurrentUser`) 패턴을 그대로 따른다.

참고 스킬: `vercel-react-best-practices`, `frontend-code-style`.

---

## 디자인 시안 요약 (Lesson Proposals.html — 레이아웃 A)

`max-width:1200px` 컨테이너, 좌우 2단 레이아웃.

**좌측 사이드바 (sticky, ~300px)**
- "내 레슨 신청" 제목
- 요약 카드: 신청일 / 지역 / 장르 / 목표 (아이콘 + 라벨 + 값 행)

**우측 메인 (flex-1)**
- "코치 제안 N개" 헤딩 + 상태 뱃지
- `ProposalCard` 리스트: 코치 아바타(이니셜 원형) + 이름 + (지역 · 전문 · 경력) + 메시지 박스 + "프로필 보기" 버튼

**코치 프로필 드로어 (우측에서 슬라이드)**
- 코치 상세: 아바타, 이름, 지역, 경력, "코치의 한마디"(메시지), 경력/전문/지역 표
- 하단 액션 버튼: "카톡 1:1 상담", "이 코치 수락하기"

**반응형 (`<900px`)**: 1단 세로 스택, 사이드바 static 전환.

---

## API 정합성 결정사항

시안 Mock과 실제 API 응답 필드가 일부 어긋나며, **API 기준으로 맞춘다**(백엔드 무수정).

| 항목 | 시안 Mock | 결정 (API 기준) |
|------|-----------|------------------|
| 코치 이름 | `name` (이수진) | `coach.activityName` |
| 지역 | `region` (서울 마포구) | `coach.region` enum → 한글 라벨 |
| 전문 분야 | `specialty` (팝·R&B) | **API에 없음 → 카드/드로어에서 생략** |
| 경력 | `exp` (10년 경력) | `coach.career`(숫자) → `${career}년 경력` |
| 메시지 | `msg` | `message` |
| 시간 | `age` (방금 전) | `createdAt` → 표시 형식은 신청일과 동일하게 `YYYY.MM.DD` |
| 신청 상태 | waiting/proposals/matched 3종 | **상태 개념 미구현 → "제안 N개"만 표시** |

지역(`Region`) enum 한글 라벨은 `features/lesson-register/lesson-register.schema.ts`의 `REGIONS` 상수에 이미 정의돼 있으나, FSD상 feature→feature 의존은 피한다. `entities/lesson-request.type.ts`에 조회용 라벨 매핑을 별도로 둔다(신청 폼이 쓰는 값과 표시용 라벨은 관심사가 다름).

---

## 아키텍처 & 파일 구조

```
app/lesson/me/page.tsx                # 서버 컴포넌트: 가드 + fetch + 분기
entities/lesson-request/
├── lesson-request.api.ts             # getMyLessonRequest(), getMyLessonOffers() (server-only)
└── lesson-request.type.ts            # LessonRequest, LessonOffer 타입 + Region/Genre 라벨
features/lesson-me/ui/
├── LessonMeView.tsx                  # 'use client' 루트 (레이아웃 A + 드로어 상태)
├── ApplicationSummary.tsx            # 좌측 요약 카드
├── ProposalCard.tsx                  # 코치 제안 카드
├── CoachProfileDrawer.tsx            # 코치 상세 드로어 (버튼 렌더, 동작 로직 없음)
└── EmptyApplication.tsx              # 신청 없을 때 (메시지 + "레슨 신청하기" 버튼)
```

**FSD 레이어**: `app → features → entities → shared` 단방향 준수. 조회 API는 도메인 데이터 읽기이므로 `entities`에 둔다(`getCurrentUser`와 동일 성격). `offer`는 신청에 종속된 개념이라 별도 엔티티로 쪼개지 않고 `lesson-request` 안에 함께 둔다.

---

## 데이터 흐름 & 가드 (page.tsx)

1. `getCurrentUser()` (이미 `react.cache()` 적용됨) → 비로그인 또는 `role !== 'STUDENT'`면 `redirect('/')` (register 페이지와 동일 가드)
2. `getMyLessonRequest()` 호출
   - 결과가 `null`(신청 없음)이면 → `<EmptyApplication />` 렌더하고 종료 (offers fetch 안 함)
   - 신청이 있으면 → `getMyLessonOffers()` fetch 후 `<LessonMeView request={...} offers={...} />` 렌더
3. 신청 null일 때 offers를 받지 않는 것은 의도된 분기다(신청 없으면 제안 자체가 무의미). request→offers 순차이지만 불필요한 왕복을 없애는 게 우선.

`lesson-request.api.ts`는 `user.api.ts`와 동일 패턴:
`createClient()` → `getSession()` → `access_token` → `fetch(\`${NEXT_PUBLIC_API_URL}/...\`, { headers: { Authorization: Bearer }, cache: 'no-store' })`.

---

## UI 컴포넌트 상세

`shared/ui` 우선 사용: `drawer`(코치 프로필), `avatar` 또는 이니셜 원형, `button`, `badge`. 아이콘은 lucide(`MapPin`, `Music`, `Target`, `CalendarDays`, `Clock`, `Users`)로 시안 인라인 SVG를 대체.

스타일은 Tailwind 클래스 + globals.css 토큰(`--green-*`, `--neutral-*`, `--radius-*`, `--shadow-*`)으로. `style` 속성 대신 클래스 사용.

- **LessonMeView** (`'use client'`): 레이아웃 A 컨테이너. `selectedCoach` 상태(드로어용)만 `useState`로 관리. 제안 리스트가 비어 있으면 시안 EmptyState("아직 제안이 없어요") 표시. 서브 컴포넌트는 파일 밖(별도 파일)으로 분리해 `rerender-no-inline-components` 준수, 메인 컴포넌트를 파일 상단 배치(CS-3).
- **ApplicationSummary**: 신청일/지역/장르/목표 정보 행. (수락 범위 제외이므로 시안의 "신청 삭제" 버튼은 넣지 않음 — 조회 전용)
- **ProposalCard**: 아바타 + `activityName` + (지역 라벨 · `career`년 경력) + 메시지 + "프로필 보기" 버튼. hover 효과는 `--shadow-*` 토큰. map 콜백 파라미터는 `offer`로(CS-2).
- **CoachProfileDrawer**: `shared/ui/drawer`의 `direction="right"`. 코치 상세 표시. 하단 "카톡 상담" / "이 코치 수락하기" 버튼은 **렌더하되 onClick 동작 없음**(추후 기능 연결). 닫기만 동작.
- **EmptyApplication**: "아직 신청한 레슨이 없어요" 메시지 + "레슨 신청하기" 버튼(→ `/lesson/register`, next `Link`).

---

## 범위 밖 (이번 작업 제외)

- 레슨 제안 수락 / 매칭 완료 / 신청 삭제 등 상태 변경 로직
- 신청 상태(waiting/proposals/matched) 개념 — API 미구현
- 코치 1:1 카톡 상담 연결
- offers는 백엔드가 임시 Mock을 반환하므로 그대로 표시

---

## Verification

1. `pnpm turbo dev --filter=@mulink/web` 로 dev 서버 실행
2. STUDENT 계정 + 신청 내역 있는 상태로 `/lesson/me` 접속:
   - 좌측 요약 카드에 신청일/지역/장르/목표가 보이는지
   - 우측에 Mock 코치 제안 3건이 카드로 렌더되는지
   - "프로필 보기" → 우측 드로어가 열리고 코치 상세가 보이는지, 닫기 동작
   - 데스크탑 2단 / 모바일(<900px) 1단 전환 확인
3. 신청 내역 없는 계정으로 접속 → "레슨 신청하기" 버튼이 있는 빈 상태 화면, 버튼 클릭 시 `/lesson/register` 이동
4. 비로그인 / 코치 계정 접속 → `/`로 redirect
5. `pnpm turbo check-types --filter=@mulink/web` 및 `pnpm turbo lint --filter=@mulink/web` 통과
