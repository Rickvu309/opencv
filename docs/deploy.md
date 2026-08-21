# Deploying the web app to Vercel

`main` deploys to production; every other branch gets a preview URL. The build
settings live in `vercel.json` at the repo root rather than in the Vercel
dashboard — `vercel.json` wins over the dashboard's build fields, so those can
stay untouched. Root Directory and Ignored Build Step are dashboard-only and are
covered under setup below.

| Field             | Value                            | Why                                                                                                                                                                                                                  |
| ----------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `installCommand`  | `pnpm install --frozen-lockfile` | Fails the build when `pnpm-lock.yaml` drifts from `package.json` instead of silently resolving something new.                                                                                                        |
| `buildCommand`    | `pnpm turbo build --filter=web`  | Builds only the web app and its workspace dependencies. `apps/api` is not part of this deployment.                                                                                                                   |
| `outputDirectory` | `apps/web/dist`                  | Where Vite writes the build. `apps/web/src/test/deploy-config.test.ts` compares it against Vite's resolved `build.outDir`, so `pnpm test` catches drift — nothing checks it at deploy time.                          |
| `rewrites`        | `/(.*)` → `/index.html`          | TanStack Router routes client-side. Without this, a hard refresh on any route but `/` returns 404. Vercel checks the filesystem before applying rewrites, so the hashed files under `/assets/` still serve as files. |

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

The home page renders the result of `GET /health` against that base URL, so any
deployment shows whether its API is reachable without opening devtools.

## Previews

Pushing any branch to GitHub creates a preview deployment. The URL appears on
the commit in GitHub and in the Vercel project's Deployments list.

## When a build fails

A failed build fails the deployment — production keeps serving the last good
deploy, and the failing deployment is marked **Error** in the Deployments list
with the full log. Both failure modes exit non-zero and stop the deploy:

- a type error (`tsc -b` runs before `vite build`)
- a lockfile mismatch (`--frozen-lockfile`)

Lint and tests are **not** part of the deploy. `pnpm turbo build --filter=web`
only compiles, so a branch with failing tests still produces a green preview.
Run `pnpm test` and `pnpm typecheck` yourself, or add CI, before trusting a
preview as reviewed.

Reproduce a Vercel build locally with the same commands:

```bash
pnpm install --frozen-lockfile
pnpm turbo build --filter=web
pnpm --filter web preview   # serve apps/web/dist
```

`vite preview` does its own SPA fallback, so deep links work locally whether or
not the `rewrites` entry is present. Local success does not verify the Vercel
rewrite — that is only observable on a real deployment.
