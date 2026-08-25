# OpenPath

Personalised AI career coaching monorepo (`apps/web`, `apps/api`, `packages/ui`).

## Local development

```bash
pnpm install
pnpm dev
```

- Web: http://localhost:5173
- API health: http://localhost:3001/health
- Storybook: http://localhost:6006 (`pnpm storybook`)

Copy `.env.example` to `.env` (or `.env.local`) and fill in values as features need them.

API schema changes: edit `apps/api/src/db/schema.ts`, generate SQL with
`pnpm --filter api run db:generate`, commit `apps/api/drizzle/`. CI applies
migrations from scratch; Railway `preDeploy` applies them per environment
(`docs/railway.md`). New accounts get a starter workspace on signup. To seed
an existing empty dev/staging user: `pnpm --filter api run db:seed`.

## Useful scripts

| Script | Purpose |
| --- | --- |
| `pnpm dev` | Run web + api |
| `pnpm build` | Production builds |
| `pnpm test` | Workspace tests |
| `pnpm typecheck` | Typecheck all packages |
| `pnpm storybook` | UI kit catalog (http://localhost:6006) |
| `pnpm build-storybook` | Static Storybook output (`packages/ui/storybook-static`) |

## Deployment

`apps/web` deploys to Vercel: `main` → production, every other branch → a preview URL. Build settings live in `vercel.json`. Production: https://openpath-app.vercel.app.

The owned UI kit catalog is Storybook in `packages/ui`. It deploys to its own Vercel project from `main` (Root Directory `packages/ui`, settings in `packages/ui/vercel.json`). Live catalog: https://openpath-storybook.vercel.app. See `docs/deploy.md`.

Domain and product docs: `CONTEXT.md`, `PRODUCT.md`, `AGENTS.md`, `docs/adr/`.
