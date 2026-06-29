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

## Step 0 — shared/ui dialog/drawer 스타일 정돈 (선행 작업)

페이지 구현에 앞서, 시안의 모달/드로어 외형을 `shared/ui`의 공용 `dialog`/`drawer` 컴포넌트에 반영한다. 공용 컴포넌트라 다른 페이지에도 영향을 주므로, **시안 픽셀을 하드코딩하지 않고 globals.css 디자인 토큰 기준으로 근사**한다(토큰 중심 정돈).

**시안 참고값** — 모달: `border-radius 22px`, 큰 그림자(`0 24px 60px`), 진한 오버레이(`rgba(20,30,22,.45)` + blur). 드로어: 우측 `width 420px`, `-8px 0 48px` 그림자, 오버레이 `rgba(20,30,22,.3)`.

**`shared/ui/dialog/dialog.tsx`**
- `DialogOverlay`: `bg-black/10` → `bg-foreground/40` (시안의 진한 오버레이 근사). 기존 backdrop-blur 유지.
- `DialogContent`: `rounded-xl` → `rounded-2xl`(시안 22px ≈ `--radius-xl`), `ring-1 ring-foreground/10` → `shadow-xl`(`--shadow-xl`이 시안 큰 그림자와 거의 일치), 패딩은 토큰 기준 상향(`p-4` → `p-6`).

**`shared/ui/drawer/drawer.tsx`**
- `DrawerOverlay`: `bg-black/10` → `bg-foreground/30`.
- `DrawerContent`: right/left 방향 `sm:max-w-sm`(384px) → `sm:max-w-md`(448px, 시안 420px 근사), 그림자 `shadow-xl` 추가.

토큰에 없는 정확한 값(420px, 시안 오버레이 색)은 기존 토큰(`--shadow-xl`, `--radius-xl`, `foreground` 별칭)으로 근사한다. **신규 토큰은 추가하지 않는다**(토큰 중심 정돈 방침). 변경은 외형 className에 국한하고, 컴포넌트 구조/props는 건드리지 않는다.

참고: `dialog`/`drawer`는 현재 코드베이스 어디에서도 사용되지 않아(이번 페이지가 첫 도입처) Step 0 외형 변경의 부수효과 위험은 없다.

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
├── AcceptCoachDialog.tsx             # "이 코치와 매칭할까요?" 다이얼로그 (수락 확정 로직 없음)
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

`shared/ui` 우선 사용: `drawer`(코치 프로필), `dialog`(수락 확인), `avatar` 또는 이니셜 원형, `button`, `badge`. 아이콘은 lucide(`MapPin`, `Music`, `Target`, `CalendarDays`, `Clock`, `Users`, `Check`)로 시안 인라인 SVG를 대체.

**상호작용 흐름**: 카드 "프로필 보기" → `CoachProfileDrawer` 열림 → 드로어 하단 "이 코치 수락하기" → `AcceptCoachDialog` 열림("이 코치와 매칭할까요?") → "수락 확정"(동작 없음) / "취소". 이 흐름의 상태는 모두 `LessonMeView`에서 관리한다.

스타일은 Tailwind 클래스 + globals.css 토큰(`--green-*`, `--neutral-*`, `--radius-*`, `--shadow-*`)으로. `style` 속성 대신 클래스 사용.

- **LessonMeView** (`'use client'`): 레이아웃 A 컨테이너. 드로어용 `selectedCoach`와 수락 다이얼로그용 `acceptCoach`(또는 dialog open) 상태를 `useState`로 관리. 제안 리스트가 비어 있으면 시안 EmptyState("아직 제안이 없어요") 표시. 서브 컴포넌트는 파일 밖(별도 파일)으로 분리해 `rerender-no-inline-components` 준수, 메인 컴포넌트를 파일 상단 배치(CS-3).
- **ApplicationSummary**: 신청일/지역/장르/목표 정보 행. (수락 범위 제외이므로 시안의 "신청 삭제" 버튼은 넣지 않음 — 조회 전용)
- **ProposalCard**: 아바타 + `activityName` + (지역 라벨 · `career`년 경력) + 메시지 + "프로필 보기" 버튼. hover 효과는 `--shadow-*` 토큰. map 콜백 파라미터는 `offer`로(CS-2).
- **CoachProfileDrawer**: `shared/ui/drawer`의 `direction="right"`. 코치 상세 표시. 하단 "카톡 상담" 버튼은 **렌더하되 동작 없음**. "이 코치 수락하기" 버튼은 클릭 시 드로어를 닫고 `AcceptCoachDialog`를 연다(UI 흐름까지만 — 실제 수락 API 호출은 없음). 닫기 동작.
- **AcceptCoachDialog**: `shared/ui/dialog`. 제목 "이 코치와 매칭할까요?", 코치 요약(아바타·이름·지역·경력), "취소"/"수락 확정" 버튼. **"수락 확정"은 렌더만 하고 동작 로직 없음**(다이얼로그 닫기 정도). 시안의 "나머지 제안은 자동 거절" 안내 문구 포함.
- **EmptyApplication**: "아직 신청한 레슨이 없어요" 메시지 + "레슨 신청하기" 버튼(→ `/lesson/register`, next `Link`).

---

## 범위 밖 (이번 작업 제외)

- 레슨 제안 수락 / 매칭 완료 / 신청 삭제 등 상태 변경 **로직** (수락 다이얼로그 UI 흐름은 구현하되, "수락 확정" 버튼에 API 호출/상태 변경 로직은 달지 않음)
- 신청 상태(waiting/proposals/matched) 개념 — API 미구현
- 코치 1:1 카톡 상담 연결
- offers는 백엔드가 임시 Mock을 반환하므로 그대로 표시

---

## Verification

0. Step 0 확인: dialog/drawer 스타일 변경 후 기존에 이 컴포넌트를 쓰는 페이지가 깨지지 않는지(외형만 변경) 점검
1. `pnpm turbo dev --filter=@mulink/web` 로 dev 서버 실행
2. STUDENT 계정 + 신청 내역 있는 상태로 `/lesson/me` 접속:
   - 좌측 요약 카드에 신청일/지역/장르/목표가 보이는지
   - 우측에 Mock 코치 제안 3건이 카드로 렌더되는지
   - "프로필 보기" → 우측 드로어가 열리고 코치 상세가 보이는지, 닫기 동작
   - 드로어 "이 코치 수락하기" → 드로어 닫히고 `AcceptCoachDialog`("이 코치와 매칭할까요?")가 열리는지, "수락 확정"/"취소" 클릭 시 다이얼로그가 닫히는지(수락 API 호출은 없음)
   - 데스크탑 2단 / 모바일(<900px) 1단 전환 확인
3. 신청 내역 없는 계정으로 접속 → "레슨 신청하기" 버튼이 있는 빈 상태 화면, 버튼 클릭 시 `/lesson/register` 이동
4. 비로그인 / 코치 계정 접속 → `/`로 redirect
5. `pnpm turbo check-types --filter=@mulink/web` 및 `pnpm turbo lint --filter=@mulink/web` 통과
