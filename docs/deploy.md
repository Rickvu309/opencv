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
3. Deploy. No environment variables are needed yet; the web app talks to no API
   until QVE-85 wires `VITE_API_URL`.

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
