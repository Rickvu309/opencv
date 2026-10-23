# Host web and api on Railway behind opencv.me

**Status.** Accepted. Supersedes the hosting line of ADR-0001.

**Context.** ADR-0001 put the web app and Storybook on Vercel and only the api and Postgres on Railway. The product now lives at `opencv.me` in a Cloudflare zone, Railway stops reading `railway.json` on 2026-12-01, and the operator asked for one host. Per-branch Vercel previews go away; the `staging` environment stands in for them.

**Decision.** Railway runs `api`, `Postgres` and `web` in `production` and `staging`. `web` is a two-stage image: `node:20-slim` builds `apps/web` with `VITE_API_URL` as a build arg, then `caddy:2-alpine` serves `apps/web/dist` with an SPA fallback and a `/health` route. `.railway/railway.ts` replaces `railway.json` and holds the build, watch-path and health settings of both services. Secrets, `AUTH_URL` and `WEB_ORIGINS` stay out of it, because the cutover flips them last by hand. Cloudflare proxies `opencv.me`, `www` and `staging` and leaves `api` and `api-staging` DNS-only until the Coach SSE smoke passes through the proxy. `docs/deploy.md` carries the layout, the DNS table, the cutover order and the rollback.

**Consequences.** `SameSite=None; Secure` stays in `apps/api/src/auth.ts` during the overlap, because the old Vercel web is cross-site to the api; it can move to `Lax` once only `opencv.me` calls the api. `apps/web/src/lib/api.ts` keeps its localhost fallback. The Postgres schema stays `openpath_app` as an internal id. Moving `AUTH_URL` to `api.opencv.me` signs every user out once, because cookies are host-only. `railway.json`, `vercel.json`, `docs/railway.md` and the force-deploy stub are deleted. Cloudflare Pages stays the fallback if Railway static hosting disappoints.
