# OpenCV

OpenCV is a job-search app for Vietnamese students and new graduates. It combines an AI career coach, a CV and cover-letter editor, a job application tracker, and a recruiter inbox.

## Project structure

- `apps/web` contains the React SPA built with Vite and TanStack Router.
- `apps/api` contains the Hono API, Better Auth, and Drizzle database code.
- `packages/domain` defines the typed contract shared by the web app and API.
- `packages/ui` contains shared UI components.
- `packages/paper-crdt` contains shared document collaboration code.
- `packages/guards` runs the repository's guard and test groups.
- `packages/stageshow` contains the product illustration kit.

## Run locally

Use Node.js 22.16 or later and pnpm 10.33.4. Local development can use PGlite and a fake Coach without PostgreSQL or model API keys.

```bash
pnpm install
mkdir -p apps/api/.data
export DB_DRIVER=pglite COACH_RUNTIME=fake
export SESSION_SECRET="$(openssl rand -hex 24)"
pnpm dev --env-mode=loose
```

The default web address is http://localhost:5173. The API health endpoint is http://localhost:3001/health. Worktrees use the assigned `PORT` for the API and `PORT + 1000` for the web app. See `.env.example` for configuration options. Keep secrets out of Git.

## Checks

```bash
pnpm check
pnpm build
```

`pnpm check` runs checks for changed files. `pnpm check:full` runs the full check suite.

## Contributing

Follow the repository rules in [AGENTS.md](AGENTS.md). Start from a GitHub issue, work in an assigned worktree, and submit changes through a pull request.
