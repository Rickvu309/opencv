# Tech stack

The technologies this repo uses. A new feature picks from this table. How a write lands is [`map.md`](map.md). How it is hosted is [`hosting.md`](hosting.md).

| Layer | Choice | Rule |
|---|---|---|
| Language | TypeScript, Node 24 | `.nvmrc`. Earlier Node cannot strip types. |
| UI | React 19 | Server and browser. |
| Framework | TanStack Start | Vite + Nitro + Router. Routes in `src/routes`. |
| Styling | Tailwind CSS v4 | Tokens in `src/styles/globals.css`. |
| Components | shadcn/ui | `src/components/ui`. |
| Server state | TanStack Query | Satellite reads. Not AppState. |
| Live lists | TanStack DB | Read-model from AppState. |
| Forms | TanStack Form | Real forms: auth, support, onboarding. |
| Tables | TanStack Table | Tabular lists. |
| Validation | Zod | Search params, API bodies, action inputs. |
| Database | PostgreSQL + `pg` | SQL migrations in `src/lib/db/migrations/`. No Drizzle. |
| Models | Vercel AI SDK (`ai`) | Gateway in `src/lib/ai/`. OpenRouter behind it. |
| Coach runtime | eve | Vercel agent framework. Process in `agent/`. |
| Hosting | Railway | Web app, eve process, Postgres. |

## Not in the stack

| Sometimes assumed | What we use instead |
|---|---|
| Drizzle | `pg` and numbered SQL files |
| n8n | Web heartbeat (`scripts/cron-once.mjs`) and `GET /api/cron` |
| `@ai-sdk/react` | `ai` + `@ai-sdk/openai-compatible`. Coach UI talks to eve. |
| Vercel as the app host | Railway. `@vercel/og` is only `/p/:slug/og`. |

## Request path

```
Browser
  → TanStack Start (Nitro)
      → src/routes
      → Zod
      → Query / Form / Table / DB as above
      → AppState → Postgres
  → /eve/* proxied to the eve process
```

Local: `npm run dev` (Vite + eve). Production web: `npm run build` then `npm start`. Agent: `npx eve build` then `npx eve start`.
