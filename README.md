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

`apps/web` deploys to Vercel: `main` → production, every other branch → a preview URL. Build settings live in `vercel.json`.

The owned UI kit catalog is Storybook in `packages/ui`. It deploys to its own Vercel project from `main` (Root Directory `packages/ui`, settings in `packages/ui/vercel.json`). See `docs/deploy.md`.

Domain and product docs: `CONTEXT.md`, `PRODUCT.md`, `AGENTS.md`, `docs/adr/`.
