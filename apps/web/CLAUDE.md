@AGENTS.md

## 아키텍처

Feature-Sliced Design (FSD):

레이어 임포트 방향: `app → widgets → features → entities → shared` 단방향만 허용

```
src/
├── app/       # Next.js App Router (라우팅, 레이아웃)
├── widgets/   # 복합 컴포넌트 (Header, Footer 등)
├── features/  # 기능 단위 모듈
├── entities/  # 도메인 엔티티
└── shared/    # 공통 UI, 유틸, API 클라이언트
```

서버 컴포넌트 기본, `'use client'`는 인터랙티브에만 사용


## 코딩 컨벤션

### 작업 원칙

- **요청 이상 구현 금지** — "시니어 엔지니어가 보면 과하다 할까?" 자문
- **모호하면 묻기** — 해석이 여러 가지면 나열해서 확인, 혼자 선택 금지
- **shared/ui 우선** — 새 컴포넌트 작성 전 `src/shared/ui/`에 적합한 것 있는지 확인. 없으면 shadcn/ui 기준으로 추가할지 사용자에게 먼저 확인
- **스타일링**: `style` 속성 대신 Tailwind 클래스 사용
- **디자인 시스템 우선 사용** - 스타일 작업 시 `src/app/globals.css`에 정의된 MU:LINK 디자인 토큰(`--primary`, `--green-*`, `--radius-*`, `--shadow-*` 등)을 우선 사용한다.
- **네이밍**: 역할이 즉시 파악되는 명확한 이름
