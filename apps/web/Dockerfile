FROM node:22-slim AS build
WORKDIR /app
RUN corepack enable
COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
ARG VITE_PUBLIC_ORIGIN
ARG VITE_APP_ORIGIN
ENV VITE_PUBLIC_ORIGIN=$VITE_PUBLIC_ORIGIN
ENV VITE_APP_ORIGIN=$VITE_APP_ORIGIN
RUN pnpm install --frozen-lockfile && pnpm turbo build --filter=web
ARG RAILWAY_GIT_COMMIT_SHA
RUN echo "${RAILWAY_GIT_COMMIT_SHA:-unknown}" > apps/web/dist/version.txt

FROM caddy:2-alpine
COPY --from=build /app/apps/web/dist /srv
COPY apps/web/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/web/.generated/host-routing.caddy /etc/caddy/host-routing.caddy
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
