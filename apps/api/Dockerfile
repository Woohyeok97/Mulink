# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
RUN apk add --no-cache openssl && corepack enable
WORKDIR /repo

# ---- build: 의존성 설치 + prisma generate + nest build + 운영 의존성만 추출 ----
# 루트 .npmrc의 node-linker=hoisted는 Amplify 배포용이라 지울 수 없다.
# 도커에선 hoisted면 pnpm deploy가 워크스페이스 전체를 섞어 담아 이미지가 커지므로,
# 이 스테이지에서만 isolated(링크 방식)로 되돌려 deploy가 api 운영 의존성만 골라내게 한다.
FROM base AS build
ENV npm_config_node_linker=isolated
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json ./apps/api/package.json
RUN pnpm install --filter=@mulink/api... --frozen-lockfile
COPY apps/api ./apps/api
RUN pnpm --filter=@mulink/api exec prisma generate
RUN pnpm --filter=@mulink/api run build
# dist + 운영 의존성만 링크를 실물로 풀어 독립 폴더(/out)로 추출
RUN pnpm --filter=@mulink/api deploy --prod /out

# ---- runner: 추출된 /out 만 담은 최종 실행 이미지 ----
FROM node:22-alpine AS runner
RUN apk add --no-cache openssl
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/dist ./dist
COPY --from=build /out/package.json ./package.json
# prisma client는 빌드 산출물이라 deploy가 안 챙긴다. 별도로 복사(코드가 generated/prisma를 상대경로로 참조)
COPY --from=build /repo/apps/api/generated ./generated
WORKDIR /app
EXPOSE 4000
CMD ["node", "dist/src/main"]
