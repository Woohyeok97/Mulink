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

## 디자인 시스템

컴포넌트 작업 시 `src/app/globals.css`에 정의된 MU:LINK 디자인 토큰(`--primary`, `--green-*`, `--radius-*`, `--shadow-*` 등)을 우선 사용한다.
