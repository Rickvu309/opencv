# Monorepo, Vercel + Railway, TypeScript web/API

OpenPath is AI-native: the AI can act in-app on the user's behalf via tools. Primary UI shape (chat-first vs mixed) is not decided here. This ADR records the current platform shape; revisit and supersede it when a change is deliberate.

**Repo:** one monorepo — `apps/web`, `apps/api`, `packages/ui` (Storybook colocated with the UI package).

**Hosting:** Vercel for web and Storybook (`main` → production, ticket branches → previews). Railway for API (including AI runtime), and Postgres (production + one non-prod).

**Stack:** TypeScript everywhere; web = Vite + React + TanStack Router + TanStack Query; UI = React package + Storybook; API = thin HTTP service (e.g. Hono) with server-side LLM, tools, and streaming; data = Postgres. AI runtime lives in `apps/api` until long-running work justifies a separate worker.

**Deferred:** LLM SDK, tRPC vs REST, auth vendor, primary UI shape, and product-domain details.

**Out of scope for now:** multi-repo; primary API on Vercel; TanStack Start; Next.js; a separate AI worker from the start.
