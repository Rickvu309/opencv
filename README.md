# OpenCV

Personalised AI career coaching monorepo (`apps/web`, `apps/api`, `packages/ui`).

## Local development

```bash
pnpm install
pnpm dev
```

- Web: http://localhost:5173
- API health: http://localhost:3001/health

Copy `.env.example` to `.env` (or `.env.local`) and fill in values as features need them.

API schema changes: edit `apps/api/src/db/schema.ts`, generate SQL with
`pnpm --filter api run db:generate`, commit `apps/api/drizzle/`. CI applies
migrations from scratch; Railway `preDeploy` applies them per environment
(`docs/railway.md`). New accounts get a starter workspace on signup. To seed
an existing empty dev/staging user: `pnpm --filter api run db:seed`.

Before merging Coach persona or prompt changes, run the manual eval harness
(`pnpm --filter api eval`). It seeds golden scenarios on a fresh test database,
calls the real OpenRouter runtime for the selected Coach mode (ADR-0009 map),
scores honesty checks plus a cheap LLM judge, and prints a markdown report.
`COACH_EVAL_MODE=free|light|max|all` picks the mode (default `free`). It is
not part of `pnpm test` or GitHub Actions — fake-runtime tests keep CI at
zero tokens. The script refuses to start without `OPENROUTER_API_KEY`.

## Useful scripts

| Script | Purpose |
| --- | --- |
| `pnpm dev` | Run web + api |
| `pnpm build` | Production builds |
| `pnpm test` | Workspace tests |
| `pnpm --filter api eval` | Manual Coach eval harness (needs `OPENROUTER_API_KEY`; never CI) |
| `pnpm --filter api smoke` | Live Coach smoke against Railway (`COACH_SMOKE_API`; never CI) |
| `pnpm typecheck` | Typecheck all packages |

## Deployment

`apps/web` deploys to Vercel: `main` → production, every other branch → a preview URL. Build settings live in `vercel.json`. Production: https://openpath-app.vercel.app.

Domain and product docs: `CONTEXT.md`, `PRODUCT.md`, `AGENTS.md`, `docs/adr/`.
