# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 작업 규칙

- **스킬 사용 시 표시**: 스킬을 사용하면 응답 첫 줄에 `🔧 사용 스킬: [스킬명] | 이유: [한 줄]`을 적고, 응답 끝에 `📋 이 응답에 사용된 스킬: [목록]`으로 요약한다.
- **패키지 설치 확인**: 새 패키지를 설치해야 할 때는 바로 설치하지 말고 먼저 설치해도 되는지 물어본다.
- **작업 위치 주의**: 모노레포다. 변경 대상이 프론트면 `apps/web`, 백엔드면 `apps/api`, 공통이면 `packages/` 안에서 작업한다. 엉뚱한 앱을 건드리지 않도록 먼저 위치를 확인한다.

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
