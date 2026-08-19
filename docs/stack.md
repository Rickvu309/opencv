# Tech stack

The technologies this product uses. A new feature picks from this table; a new technology needs an ADR.

| Layer | Choice | Rule |
|---|---|---|
| Language | TypeScript, Node 24 | `.nvmrc`. Strict mode. |
| UI | React 19 | Server and browser. |
| Framework | TanStack Start | Vite + Nitro. Routes in `src/routes`, thin; screens live in `src/features/*/screens/`. |
| Routing | TanStack Router | File routes, typed search (`validateSearch` + Zod). |
| Styling | Tailwind CSS v4 | Tokens in `src/styles/globals.css` ([design.md](design.md)). |
| Components | shadcn/ui in `packages/opath-ui` | Import as `@/ui/<name>`. No product nouns. App-wired helpers stay in `src/ui/`. [ADR 0007](adr/0007-opath-ui-in-repo.md). |
| Server state | TanStack Query | Reads from `queries.ts`, invalidated on command completion. |
| Forms | TanStack Form | Real forms: auth, onboarding, settings. |
| Tables | TanStack Table | Tabular lists. |
| Validation | Zod | Search params, command inputs, API bodies. Shapes live in `model.ts`. |
| Writes | The command bus | `src/core/commands/` ([ADR 0002](adr/0002-command-bus.md)). The only write path. |
| Database | PostgreSQL + `pg` | Numbered SQL migrations in `src/core/db/migrations/`. No ORM ([ADR 0003](adr/0003-relational-schema.md)). |
| AI | Vercel AI SDK (`ai`) | Gateway in `src/core/ai/`, OpenRouter behind it. Features ask for a model role, never a model. |
| Agent | In-process module | `src/features/coach/agent/` ([ADR 0004](adr/0004-coach-in-process.md)). Tools generated from the command registry. |
| Jobs | Postgres queue + worker | `jobs` table, drained by the `worker` service. |
| Hosting | Railway | `web`, `worker`, Postgres ([hosting.md](hosting.md)). |
| Version control | GitHub | Push to `main` deploys. |

## Not in the stack

| Sometimes assumed | What we use instead |
|---|---|
| Next.js / React Router | TanStack Start and Router |
| Drizzle / Prisma | `pg` and numbered SQL files |
| A separate agent runtime (eve or similar) | The in-process agent module |
| Redis (queue or cache) | Postgres `jobs` table; no cache until measured |
| `@ai-sdk/react` | The coach UI talks to our own SSE route |
| A client-side state store for server data | TanStack Query over server queries; the server is the source of truth |

## Request path

```
Browser
  → TanStack Start (Nitro)
      → routes (src/routes, thin)
      → server functions → command bus → Postgres     (writes)
      → server functions → queries.server.ts → Postgres (reads)
      → /api coach stream → agent module → AI gateway → OpenRouter
Worker
  → jobs table → handlers → command bus / gateway
```

Local: `npm run dev` (web + worker). Production: `npm run build`, then `npm start` (web) and `npm run worker` (worker).
