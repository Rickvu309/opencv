# Deploying the web app to Vercel

`main` deploys to production; every other branch gets a preview URL. The build
settings live in `vercel.json` at the repo root, not in the Vercel dashboard —
`vercel.json` takes precedence, so the dashboard fields can stay untouched.

| Field             | Value                            | Why                                                                                                                                                                                                               |
| ----------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `installCommand`  | `pnpm install --frozen-lockfile` | Fails the build when `pnpm-lock.yaml` drifts from `package.json` instead of silently resolving something new.                                                                                                     |
| `buildCommand`    | `pnpm turbo build --filter=web`  | Builds only the web app and its workspace dependencies. `apps/api` is not part of this deployment.                                                                                                                |
| `outputDirectory` | `apps/web/dist`                  | Where Vite writes the build. Guarded by `apps/web/src/test/deploy-config.test.ts`.                                                                                                                                |
| `rewrites`        | `/(.*)` → `/index.html`          | TanStack Router routes client-side. Without this, a hard refresh on any route but `/` returns 404. Vercel checks the filesystem before applying rewrites, so hashed assets under `/assets/` still serve as files. |

pnpm and Node versions come from `packageManager` and `engines.node` in the root
`package.json`.

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

Reproduce a Vercel build locally with the exact same commands:

```bash
pnpm install --frozen-lockfile
pnpm turbo build --filter=web
pnpm --filter web preview   # serve apps/web/dist
```

`vite preview` does not apply `vercel.json` rewrites, so deep-link behaviour is
only observable on a real deployment.
