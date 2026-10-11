FROM node:22-alpine AS frontend

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN pnpm install --frozen-lockfile

COPY apps ./apps
COPY packages ./packages

ARG APP_NAME
RUN pnpm --filter "${APP_NAME}" build

ENV NODE_ENV=production
ARG PORT=3000
ARG APP_DIR=apps/web
ENV PORT=${PORT}
ENV APP_DIR=${APP_DIR}
ENV HOSTNAME=0.0.0.0

CMD ["sh", "-c", "cd /app/${APP_DIR} && pnpm exec next start -p ${PORT}"]
