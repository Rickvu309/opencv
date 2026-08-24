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

`apps/web` calls `GET /health` through `fetchHealth` in `apps/web/src/lib/api.ts`.
The Spec 3 app shell no longer shows that check on the landing page — hit the
API host directly to confirm reachability.

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

# Deploying Storybook to Vercel

The owned kit catalog is a second Vercel project. It must not reuse the web
project — root `vercel.json` always builds `apps/web`. Storybook settings live
in `packages/ui/vercel.json` and only apply when that project's **Root
Directory** is `packages/ui`.

| Field             | Value                                           | Why                                                                                          |
| ----------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `installCommand`  | `cd ../.. && pnpm install --frozen-lockfile`    | Root Directory is `packages/ui`; the lockfile and workspaces live at the repo root.          |
| `buildCommand`    | `pnpm build-storybook`                          | Static catalog from `@storybook/react-vite`. Runs in the UI package after the root install.  |
| `outputDirectory` | `storybook-static`                              | Storybook's default static output, relative to `packages/ui`.                                |
| `framework`       | `storybook`                                     | Vercel Storybook preset; secrets stay out — this is a static front-end surface.              |

`main` deploys to the Storybook production URL; other branches get catalog
previews. Reproduce the build locally:

```bash
pnpm install --frozen-lockfile
pnpm build-storybook
```

## One-time Storybook project setup

1. In Vercel, **Add New → Project** and import `quanvu309/openpath` again (do
   not add Storybook to the existing `openpath` web project).
2. Set **Root Directory** to `packages/ui`. Vercel then reads
   `packages/ui/vercel.json` instead of the web settings at the repo root.
3. Deploy. Production URL is the public catalog; post it on QVE-87 / QVE-81
   when it first goes live.

Production catalog: https://openpath-storybook.vercel.app
(`main` and the current Storybook project both serve this alias).

