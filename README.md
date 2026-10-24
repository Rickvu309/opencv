# OpenCV

OpenCV is an AI career coach for Vietnamese students and new graduates. It helps them work out what to apply for, write CVs and cover letters that fit each job, keep track of applications, and share a portfolio page with employers. It was called OpenPath before the rename.

Public site: https://opencv.me. App: https://app.opencv.me.

## What it does

- **Coach**: a chat that gives career advice and can change the other three surfaces for you.
- **Paper**: CVs and cover letters.
- **Apply**: a tracker for the jobs you applied to.
- **Pitch**: a portfolio page you can share by link.

## Stack

| Part              | Technology                                                                         |
| ----------------- | ---------------------------------------------------------------------------------- |
| `apps/web`        | Vite, React 19, TanStack Router single-page app, served by Caddy from a Dockerfile |
| `apps/api`        | Hono, Drizzle and Better Auth on Node 22                                           |
| `packages/ui`     | shadcn-style component kit, consumed as source by `apps/web`                       |
| `packages/domain` | Domain code shared by web and api                                                  |
| Tooling           | pnpm workspaces, turbo                                                             |
| Hosting           | Railway (`api`, `web`, Postgres) behind Cloudflare                                 |

## Local setup

Local development needs no Postgres and no API keys. `DB_DRIVER=pglite` runs the database in-process and `COACH_RUNTIME=fake` replaces the model with a scripted Coach.

```bash
pnpm install
pnpm --filter @workspace/domain build
export DB_DRIVER=pglite COACH_RUNTIME=fake SESSION_SECRET="$(openssl rand -hex 24)"
pnpm dev --env-mode=loose
```

The web app is at http://localhost:5173 and the api health check is at http://localhost:3001/health. `--env-mode=loose` lets turbo pass the exported variables to the dev servers. Other variables are listed in `.env.example`.

## Scripts

| Script                              | Purpose                                                                |
| ----------------------------------- | ---------------------------------------------------------------------- |
| `pnpm dev`                          | Run web + api                                                          |
| `pnpm build`                        | Production builds                                                      |
| `pnpm test`                         | Workspace tests                                                        |
| `pnpm lint`                         | Lint all packages                                                      |
| `pnpm typecheck`                    | Typecheck all packages                                                 |
| `pnpm --filter api run db:generate` | Generate SQL after editing `apps/api/src/db/schema.ts`                 |
| `pnpm --filter api run db:seed`     | Seed a starter workspace for an existing empty user (needs a database) |
| `pnpm --filter api eval`            | Manual Coach eval harness (needs `OPENROUTER_API_KEY`; never CI)       |
| `pnpm --filter api smoke`           | Live Coach smoke; set `COACH_SMOKE_API=https://api.opencv.me`          |

## Hosting and deploy

Railway runs the `api`, `web` and Postgres services in one environment, production, behind Cloudflare at https://opencv.me, https://www.opencv.me, https://app.opencv.me and https://api.opencv.me. A merge to `main` deploys straight to production; there is no staging and no preview deploy yet. Layout, variables, DNS, rollback and migrations are in `docs/deploy.md`.

## How work happens

Every change starts with a GitHub issue, and every issue gets its own branch and worktree. There is no CI; local hooks and `scripts/review-pr.sh` are the gates.

```bash
scripts/new-task.sh <type> <issue#> -d "short description"   # branch + worktree
heavy -- scripts/open-pr.sh --draft                          # checks, push, PR
```

Read `CONTRIBUTING.md` for the full flow and `AGENTS.md` for the rules agents follow. Product and domain language are in `PRODUCT.md` and `CONTEXT.md`. Current implementation is defined by source and tests. Historical technical plans and ADRs have been retired; Git history retains them.
