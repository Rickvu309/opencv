# ADR 0004: TanStack Start replaces Next.js

Next.js 16 was the app runtime. The Coach already lived on Railway as a sibling eve process. `withEve` and Next rewrites were a second topology that only existed locally. Vercel was named in an old blueprint after hosting had moved.

**Decision:** The product runs on TanStack Start (Vite + Nitro + Router). Routes live in `src/routes`. Public URLs do not change. `gateFor` stays a pure function; Start request middleware calls it. Nitro proxies `/eve/*` and `/.well-known/workflow/*` in both dev and prod. `npm run dev` starts Vite and eve together.

AppState and `applyAction` remain the only write path for Profile, Paper, Pitch, Search, and Application. TanStack Query loads satellite reads. TanStack Form covers real forms. Writes still `dispatch`.

**Consequences:** One topology for local and Railway. The unused Next SDK is gone. The billing webhook is a public prefix so HMAC runs. The Coach contract does not change: the agent returns an envelope; the browser applies it.
