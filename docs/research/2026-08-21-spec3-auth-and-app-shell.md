# Spec 3 research: simple auth + app shell (chat + nav)

**Question:** For OpenPath Spec 3 (auth + fundamentals), what’s a fast path for email/password that can change later, and how should we think about “full shell + chat” before the layout is decided?

**Context:** Vite + React + TanStack Router web on Vercel; Hono API + Postgres on Railway; ADR-0001 deferred auth vendor and primary UI shape; Coach acts via Commands (ADR-0003); Users are Vietnamese early-career, short anxious sessions.

## Auth: simple now, swappable later

| Option | Fit | Email/password | Lock-in / swap | Speed |
|--------|-----|----------------|----------------|-------|
| **Clerk** (hosted) | Fastest UI; Vite SPA via `@clerk/react` | Supported (dashboard) | Users live at Clerk; migrate later is real work (Better Auth publishes a Clerk migration guide) | Highest |
| **Better Auth** (library on `apps/api` + Postgres) | Official [Hono mount](https://www.better-auth.com/docs/integrations/hono); sessions via cookies + `trustedOrigins` / CORS credentials | First-class [email & password](https://www.better-auth.com/docs/authentication/email-password) | Data already in **your** Postgres — closer to long-term OpenPath | Medium (you build sign-in UI from kit) |
| DIY sessions | Smallest code | You own hashing/reset/verify | No vendor | Slowest / riskiest |

**“Simple fast, later we can change” — two honest readings:**

1. **Fastest calendar time:** Clerk. Accept migration cost if you leave.  
2. **Fastest that still matches the stack and “change later” without exporting users:** Better Auth on Railway Postgres. “Change later” = add OAuth/passkeys/plugins, not rip the user table.

Better Auth documents mounting at `/api/auth/*` on Hono and session middleware via `auth.api.getSession` ([Hono integration](https://www.better-auth.com/docs/integrations/hono)). Cross-origin web↔API needs explicit CORS origins + `credentials` + `trustedOrigins` (same pattern as OpenPath’s existing `WEB_ORIGINS`).

Clerk documents Vite/React SPAs with `ClerkProvider` + publishable key and email/password flows ([Clerk React / email-password guides](https://clerk.com/docs/guides/development/custom-flows/authentication/email-password)).

**Recommendation for OpenPath Spec 3:** Prefer **Better Auth + email/password** if Spec 3 can spend ~1–3 days of agent time on forms (use `packages/ui`). Prefer **Clerk** only if the goal is “auth this week with almost no UI work” and you’re OK migrating users later.

Password reset + email verification usually need an email provider (Resend, etc.) — Spec 3 should either include a minimal “dev: log link / skip verify in non-prod” posture or a thin email ticket.

## App shell: full nav + chat without freezing the wrong layout

Industry pattern (hybrid, not chat-only):

- **Structured UI** for known intents (open Paper, save Opportunity, sign out).  
- **Conversation** when intent is fuzzy (career direction, “what next?”).  
  ([Erika Hall / conversational design summary in UX writing on hybrid interfaces](https://uxdesign.cc/the-interface-has-left-the-building-8fdb558d33a9); placement guides: [LogRocket AI placement](https://blog.logrocket.com/ux-design/ai-ui-placement/), chat+canvas / side panel patterns in [AI chat layout patterns](https://anastasiawalia.substack.com/p/ai-chat-layout-patterns-when-to-use).)

OpenPath-specific: Users need craft surfaces (Paper later) **and** a Coach. ADR-0001 left “chat-first vs mixed” open — Spec 3 should **not** pretend that’s settled.

**Three shell candidates (decide one for Spec 3 chrome only):**

| Pattern | Layout | Pros | Cons |
|---------|--------|------|------|
| **A. Nav + Coach dock** | Left (or top) nav: Home / Paper / … stubs; right or bottom **Coach panel** toggleable | Matches “full + chat”; Paper Spec 4 drops into main pane | Slightly more layout work |
| **B. Coach-home + nav** | Default route = Coach thread; nav switches craft surfaces | Feels AI-native; good for anxious “ask first” sessions | Craft surfaces feel secondary until Spec 4 |
| **C. Craft-home + summon Coach** | Default = stub home/Paper; Coach via button / shortcut (spotlight) | Max space for Paper later | Coach less visible day one |

**Recommendation:** Spec 3 ships **pattern A with stub routes** (or B if you want Coach as home). Do **not** build a third pattern in Spec 3. Treat A/B as a reversible chrome choice recorded in an ADR; Spec 4 Paper fills the main pane either way.

## Public vs gated (still open)

| Approach | Behavior |
|----------|----------|
| **Split** | Public `/` (or marketing) stays reachable; authenticated app under `/app/*` (or similar) |
| **Hard gate** | Everything behind sign-in |

Keep a **public health/demo path** so Spec 1’s “live web reaches API” smoke doesn’t require an account. Gate only the signed-in shell.

## Spec 3 scope implication

**In:** auth (chosen vendor), sign-up/sign-in email+password, session, minimal shell (chosen pattern) with stub destinations, protect `/app/*`.  
**Out:** real Paper, Opportunity, Pitch; full Coach Commands; URL rename (QVE-88); Storybook (QVE-87).

## Sources

- https://www.better-auth.com/docs/integrations/hono  
- https://www.better-auth.com/docs/authentication/email-password  
- https://clerk.com/docs/guides/development/custom-flows/authentication/email-password  
- https://clerk.com/articles/how-do-i-implement-social-login-for-my-web-app (Vite SPA `ClerkProvider`)  
- https://github.com/better-auth/better-auth/blob/canary/docs/content/docs/guides/clerk-migration-guide.mdx  
- https://uxdesign.cc/the-interface-has-left-the-building-8fdb558d33a9  
- https://blog.logrocket.com/ux-design/ai-ui-placement/  
- https://anastasiawalia.substack.com/p/ai-chat-layout-patterns-when-to-use  
