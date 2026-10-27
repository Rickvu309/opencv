# opencv

opencv is an AI career coach for Vietnamese students and new graduates. The person writes a CV and a cover letter, tracks jobs on a board, and talks to the Coach. The Coach can change those surfaces. Inbox reads recruiter mail and drafts a reply the person can send.

Live at https://opencv.me

## What ships in release one

- **Coach.** A Chat page and a Chat panel. Modes are Free, Light, and Max. Light and Max need Pro.
- **Paper.** CVs, cover letters, and a Proof placeholder.
- **Apply.** A board, a list, and a calendar for Jobs. Stages are Saved, Applied, Interview, Offer, and Closed.
- **Inbox.** Recruiter mail matched to Jobs. A fake source on a local run. Gmail when `GOOGLE_CLIENT_ID` is set.
- **Settings.** Preferences, Coach, integrations, usage, billing, and account. The start page opens after sign-in. Apply is the default. There is no Home screen.
- **Jobs, Proof, and Pitch.** Coming-soon pages. The old Pitch code is removed.
- **Upgrade to Pro.** A placeholder. Pro is granted by hand.

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
mkdir -p apps/api/.data
export DB_DRIVER=pglite COACH_RUNTIME=fake SESSION_SECRET="$(openssl rand -hex 24)"
pnpm dev --env-mode=loose
```

PGlite writes its files to `apps/api/.data/default`. That directory is gitignored, and PGlite does not create the parent, so the `mkdir` is required on a fresh checkout. The web app is at http://localhost:5173 and the api health check is at http://localhost:3001/health. A worktree stores its api port as `PORT` in `.env`, and `pnpm dev` puts the api on `PORT` and the web on `PORT + 1000`. `--env-mode=loose` lets turbo pass the exported variables to the dev servers. Other variables are listed in `.env.example`.

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

## Design

The release-one design is not on `main`. It lives on branch `chore/350-design-kit-cli-skills`.

```bash
git fetch origin chore/350-design-kit-cli-skills
git worktree add ../opencv.worktrees/350-design-kit-cli-skills origin/chore/350-design-kit-cli-skills
```

The files are `design/opencv.pen`, `design/exports`, and `design/cli`. From that worktree, run the kit CLI with `node design/cli/bin/opencv.js`.

## How work happens

Every change starts with a GitHub issue, and every issue gets its own branch and worktree. There is no CI. Local hooks and `scripts/review-pr.sh` are the gates.

```bash
scripts/new-task.sh <type> <issue#> -d "short description"   # branch + worktree
heavy -- scripts/open-pr.sh --draft                          # checks, push, PR
```

Read `CONTRIBUTING.md` for the full flow and `AGENTS.md` for the rules agents follow.

## Docs

| Doc                  | What it holds                                |
| -------------------- | -------------------------------------------- |
| `PRODUCT.md`         | Release one, as the design draws it          |
| `CONTEXT.md`         | The glossary                                 |
| `docs/adr/`          | Decisions `0001` to `0009`. `0009` is a stub |
| `docs/deploy.md`     | Railway and Cloudflare runbook               |
| `docs/agents/`       | How agents read issues and the glossary      |
| `docs/git-workflow/` | Branches, worktrees, review, and deploys     |
| `AGENTS.md`          | Rules for agents                             |
| `CONTRIBUTING.md`    | Rules for people and agents                  |
