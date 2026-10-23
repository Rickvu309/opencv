FROM node:22-slim AS build
WORKDIR /app
RUN corepack enable
COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm install --frozen-lockfile && pnpm turbo build --filter=web

FROM caddy:2-alpine
COPY --from=build /app/apps/web/dist /srv
COPY apps/web/Caddyfile /etc/caddy/Caddyfile
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
