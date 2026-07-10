# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
RUN apk add --no-cache openssl && corepack enable
WORKDIR /repo

# ---- deps: 의존성 설치 (캐시 극대화 위해 package.json만 먼저 복사) ----
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json ./apps/api/package.json
RUN pnpm install --filter=@mulink/api... --frozen-lockfile

# ---- build: 소스 복사 + prisma generate + nest build ----
FROM base AS build
COPY --from=deps /repo ./
COPY apps/api ./apps/api
RUN pnpm --filter=@mulink/api exec prisma generate
RUN pnpm --filter=@mulink/api run build

# ---- runner: 최종 실행 이미지 ----
# pnpm의 apps/api/node_modules 심볼릭 링크가 루트 node_modules/.pnpm을 상대경로로 가리키므로
# /repo 구조를 그대로 유지해야 링크가 깨지지 않는다.
FROM node:22-alpine AS runner
RUN apk add --no-cache openssl
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/api/generated ./apps/api/generated
COPY --from=build /repo/apps/api/package.json ./apps/api/package.json
# ponytail: node_modules 전체 복사(devDeps 포함), 용량 문제되면 --prod 전용 설치 스테이지 추가
COPY --from=build /repo/apps/api/node_modules ./apps/api/node_modules
WORKDIR /repo/apps/api
EXPOSE 4000
CMD ["node", "dist/src/main"]
