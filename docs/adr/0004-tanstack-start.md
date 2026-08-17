# TanStack Start replaces Next.js; AppState stays the write path

Next.js 16 was the app runtime. The Coach already lived on Railway as a sibling eve process, and `withEve` plus `next.config.ts` rewrites were a second topology that only existed in local Next. Vercel was named in the Web App blueprint long after hosting had moved.

**Decision:** The product runs on TanStack Start (Vite + Nitro) with TanStack Router. Routes stay at repo-root `app/` (`srcDirectory: '.'`). Public URLs do not change. `gateFor` stays a pure function; Start request middleware calls it. Nitro proxies `/eve/*` and `/.well-known/workflow/*` in both dev and prod. `npm run dev` starts Vite and eve together.

AppState and `applyAction` remain the only write path for Profile, Paper, Pitch, Search, and Application. TanStack Query loads satellite server state (conversations, public Proof, billing, waitlist, blobs). TanStack Form covers real forms. Drive may use Table and a DB read-model collection. Writes still `dispatch`.

**Consequences:** One topology for local and Railway. The unused Next SDK (`flags/next`, `@vercel/connect`) is gone. The billing webhook is a public prefix so HMAC runs. The Coach contract does not change: the agent returns an envelope; the browser applies it.
