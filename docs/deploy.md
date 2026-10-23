# Deploying the web app to Vercel

`main` deploys to production; every other branch gets a preview URL. The build
settings live in `vercel.json` at the repo root rather than in the Vercel
dashboard — `vercel.json` wins over the dashboard's build fields, so those can
stay untouched. Root Directory and Ignored Build Step are dashboard-only and are
covered under setup below.

Production web: https://openpath-app.vercel.app

That hostname is a project domain on the existing `openpath` Vercel web
project (not a second app). The previous auto alias
`https://openpath-lovat.vercel.app` 308-redirects there. Team aliases
(`openpath-rickvudev.vercel.app`, `openpath-git-main-rickvudev.vercel.app`)
still serve the same production deployment without redirecting.

| Field             | Value                            | Why                                                                                                                                                                                                                      |
| ----------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `installCommand`  | `pnpm install --frozen-lockfile` | Fails the build when `pnpm-lock.yaml` drifts from `package.json` instead of silently resolving something new.                                                                                                            |
| `buildCommand`    | `pnpm turbo build --filter=web`  | Builds only the web app and its workspace dependencies. `apps/api` is not part of this deployment.                                                                                                                       |
| `outputDirectory` | `apps/web/dist`                  | Where Vite writes the build. `apps/web/src/test/deploy-config.test.ts` compares it against Vite's resolved `build.outDir`. GitHub Actions (`pnpm test` on every PR and every push to `main`) catches drift before merge. |
| `rewrites`        | `/(.*)` → `/index.html`          | TanStack Router routes client-side. Without this, a hard refresh on any route but `/` returns 404. Vercel checks the filesystem before applying rewrites, so the hashed files under `/assets/` still serve as files.     |

pnpm comes from `packageManager` in the root `package.json`. Node comes from
`engines.node`, which is the open range `>=20` — Vercel resolves that to its
newest supported major, so the version can move under us. Pin it there if a
future build needs a specific major.

## One-time setup

1. In Vercel, **Add New → Project** and import `quanvu309/openpath`.
2. Leave **Root Directory** as the repository root. `vercel.json` points the
   build at `apps/web` — setting the root directory to `apps/web` would make
   Vercel look for `apps/web/vercel.json` instead and lose these settings.
3. Deploy.

## Reaching the API

The web app reads the API base URL from `VITE_API_URL`. Vite bakes it into the
bundle at build time, so it is a build input, not a runtime setting: changing it
in Vercel only takes effect on the next deployment. When it is unset the app
falls back to `http://localhost:3001` (see `apps/web/src/lib/api.ts`), which is
what local `pnpm dev` wants.

| Vercel environment | `VITE_API_URL`                               |
| ------------------ | -------------------------------------------- |
| Production         | `https://api-production-0876.up.railway.app` |
| Preview            | `https://api-staging-f689.up.railway.app`    |
| Development        | `http://localhost:3001`                      |

Previews point at the Railway `staging` environment, which has its own Postgres,
so branch work never touches production data. The API decides which origins may
call it — see `WEB_ORIGINS` in [railway.md](railway.md). Both sides have to
agree: a new web origin needs adding there, or the browser blocks the response.

`apps/web` calls `GET /health` through `fetchHealth` in `apps/web/src/lib/api.ts`.
The Spec 3 app shell no longer shows that check on the landing page — hit the
API host directly to confirm reachability.

The Coach runtime lives on Railway, not Vercel. Vercel only needs
`VITE_API_URL` pointing at the right API; `OPENROUTER_API_KEY`,
and the `COACH_MODEL_*` / `COACH_DAILY_TURN_LIMIT_*` mode vars are
api-service variables. See
[Coach](railway.md#coach). When the key is absent the web app still loads —
Home send fails with the existing Retry error (`COACH_UNAVAILABLE` / 503)
and `/health` stays 200.

Vercel never applies Postgres migrations. The API on Railway runs
`pnpm --filter api run migrate` as `preDeployCommand` before each api
rollout (pglite from-scratch in CI; staging and production each have their
own Postgres). See [railway.md](railway.md#migration-pipeline). New accounts
are seeded by the API signup hook, not by the web build.

## Previews

Pushing any branch to GitHub creates a preview deployment. The URL appears on
the commit in GitHub and in the Vercel project's Deployments list.

## When a build fails

A failed build fails the deployment — production keeps serving the last good
deploy, and the failing deployment is marked **Error** in the Deployments list
with the full log. Both failure modes exit non-zero and stop the deploy:

- a type error (`tsc -b` runs before `vite build`)
- a lockfile mismatch (`--frozen-lockfile`)

Lint and tests are **not** part of the Vercel deploy. `pnpm turbo build --filter=web`
only compiles, so a branch with failing tests still produces a green preview.
GitHub Actions (`.github/workflows/ci.yml`) runs `lint`, `typecheck`, `test`,
and `build` on every pull request and every push to `main` — that check is
what to trust before merging, not the preview deploy.

Reproduce a Vercel build locally with the same commands:

```bash
pnpm install --frozen-lockfile
pnpm turbo build --filter=web
pnpm --filter web preview   # serve apps/web/dist
```

`vite preview` does its own SPA fallback, so deep links work locally whether or
not the `rewrites` entry is present. Local success does not verify the Vercel
rewrite — that is only observable on a real deployment.
