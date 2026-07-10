# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 참고 문서

작업 전 항상 `docs/PRODUCT.md`(기획)와 `docs/SPEC.md`(개발 스펙)를 참고한다.

## 작업 규칙

- **스킬 사용 시 표시**: 스킬을 사용하면 응답 첫 줄에 `🔧 사용 스킬: [스킬명] | 이유: [한 줄]`을 적고, 응답 끝에 `📋 이 응답에 사용된 스킬: [목록]`으로 요약한다.
- **패키지 설치 확인**: 새 패키지를 설치해야 할 때는 바로 설치하지 말고 먼저 설치해도 되는지 물어본다.
- **작업 위치 주의**: 모노레포다. 변경 대상이 프론트면 `apps/web`, 백엔드면 `apps/api`, 공통이면 `packages/` 안에서 작업한다. 엉뚱한 앱을 건드리지 않도록 먼저 위치를 확인한다.
- **플랜 작성 시점**: 플랜 모드에서 사용자가 명시적으로 요청할 때만 플랜을 작성한다.

## 주석 스타일

코드에 주석을 달 때 아래 규칙을 따른다. **짧고 핵심만**, 복잡하거나 중요한 부분은 '왜'까지 설명한다. 코드로 바로 읽히는 '무엇'에는 주석을 달지 않는다.

- **복잡한 흐름은 단계 주석**: 여러 단계로 이어지는 로직은 각 단계 위에 번호 주석을 단다.

  ```ts
  // 1단계: state를 쿠키에 심고 카카오 인증 화면으로 redirect
  // 2단계: 돌아온 state를 대조해 CSRF를 막고 토큰 발급
  ```

- **분기 위에 경우 설명**: `if`로 갈라질 때 어떤 경우인지 조건 위에 한 줄.

  ```ts
  // state가 없거나 어긋나면 위조 요청으로 판단
  if (!cookieState || cookieState !== state) { ... }
  ```

- **나열된 함수마다 정체 주석**: 여러 함수·핸들러가 나열되면 각 위에 무엇인지 한 줄.

  ```ts
  // 레슨 신청 조회
  async getMyLessonRequest() { ... }

  // 레슨 신청 삭제
  async removeLessonRequest() { ... }
  ```

- **핸들러·중요 변수 위 짧은 설명**: 이벤트 핸들러나 의미 있는 변수 위에 역할 한 줄.

  ```ts
  // 레슨 신청 핸들러
  const handleSubmit = ...
  ```

## 프로젝트 개요

MU:LINK(뮤링) — 보컬 코칭 매칭 플랫폼. pnpm + Turborepo 모노레포.

```
mulink/
├── apps/
│   ├── web/    # @mulink/web — Next.js 16 + React 19 프론트엔드
│   └── api/    # @mulink/api — NestJS 11 + Prisma 7 백엔드
└── packages/
    ├── eslint-config/      # @repo/eslint-config (공유 ESLint)
    └── typescript-config/  # @repo/typescript-config (공유 tsconfig)
```

## 명령어

루트에서 Turborepo로 전체 실행:

```sh
pnpm dev          # 전체 dev 서버
pnpm build        # 전체 빌드
pnpm lint         # 전체 lint
pnpm check-types  # 전체 타입체크
```

특정 앱만 실행할 때는 필터 사용:

```sh
pnpm turbo dev --filter=@mulink/web
pnpm turbo build --filter=@mulink/api
```

백엔드 테스트 (Jest, `apps/api`에서):

```sh
pnpm --filter=@mulink/api test           # 전체
pnpm --filter=@mulink/api test:watch     # watch
pnpm --filter=@mulink/api test:e2e       # e2e
pnpm --filter=@mulink/api test -- app.controller   # 단일 파일
```

프론트엔드 테스트 (Vitest + @testing-library/react, `apps/web`에서). 테스트 파일은 `*.test.ts` / `*.test.tsx`:

```sh
pnpm --filter=@mulink/web test           # 전체
pnpm --filter=@mulink/web test:watch     # watch
pnpm --filter=@mulink/web exec vitest run LessonRequestList   # 단일 파일(이름 매칭)
```

## 백엔드 (apps/api)

- NestJS 표준 구조(module / controller / service). 진입점 `src/main.ts`, 루트 모듈 `src/app.module.ts`.
- Prisma는 `src/prisma/`의 `PrismaModule` / `PrismaService`로 주입해 사용한다. DB 접근은 이 서비스를 거친다.
- 스키마: `apps/api/prisma/schema.prisma`. Client는 `apps/api/generated/prisma`로 생성된다(기본 `@prisma/client` 경로 아님). 스키마 변경 후 `pnpm --filter=@mulink/api exec prisma generate` 필요.
- 도메인 모델: `User`(role: STUDENT/COACH/ADMIN), `VocalTier`(BRONZE~DIAMOND), `LessonRequest` 등.

## 프론트엔드 (apps/web)

- Next.js 16 App Router. 소스는 `src/` 아래(`src/app/` 라우트, `src/shared/ui` 컴포넌트, `src/shared/lib`).
- UI: shadcn(style `radix-nova`) + Tailwind CSS v4 + lucide 아이콘.
- **중요**: 이 버전 Next.js는 학습 데이터와 API/규칙이 다를 수 있다. 코드 작성 전 `apps/web/node_modules/next/dist/docs/`의 관련 문서를 먼저 확인한다([apps/web/AGENTS.md](apps/web/AGENTS.md) 참고).

## Git 브랜치 전략

`main`(프로덕션, PR로만 병합) ← `dev`(개발 통합) ← `feature/기능명`(작업 브랜치). 긴급 수정은 `hotfix/이슈명`을 `main`에서 분기해 `main`+`dev` 양쪽 병합.
