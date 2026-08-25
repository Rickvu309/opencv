# Spec 4 — Auth + Data Foundation

**Status:** Ready for ticket breakdown
**Related:** ADR-0006 (data foundation decisions), ADR-0003 (Coach Commands), ADR-0005 (Thread-store seam — its extraction trigger fires here), research note `docs/research/2026-08-21-spec3-auth-and-app-shell.md` (auth comparison; Better Auth recommendation adopted)

## Problem Statement

A User's work in OpenPath is not real yet. The craft surfaces run on seed data that resets on reload; Threads live in one browser tab's sessionStorage; identity is a build-time placeholder ("Alex Tran"); anyone who opens the URL sees the same not-quite-anyone's workspace. For the target User — short, anxious sessions, often on a phone, coming back days later — nothing they make survives, which means nothing they make matters.

The API serves a health check and nothing else, while Postgres sits provisioned and unused on Railway in both environments.

## Solution

1. **Accounts.** Email + password sign-up and sign-in (Better Auth on the Hono API, cookie sessions). The whole app is behind sign-in; signed-out visitors see only the sign-in/sign-up screens. Settings → Account shows the real identity and a working sign-out.
2. **Durable, per-User data.** Postgres schema (`openpath_app`) for Threads + Messages, Paper docs, and Apply cards. Server owns timestamps; every row hangs off the User.
3. **One mutation door.** All writes go through the Command registry (`POST /api/commands/:name`) per ADR-0003 — the same validation and authorization the Coach will use later. Reads are plain REST consumed via TanStack Query, server-first with optimistic writes.
4. **Content format settled.** Paper docs store `content_kind` + `content jsonb` + `content_version` (PRODUCT.md open question 3 closed — see ADR-0006). The `cv:v1:`/`proof:v1:` prefixes retire.
5. **Thread seam extracted.** Server Threads trigger ADR-0005: History and Search consume a thin `ThreadListPort`; conversation internals stay in Home.
6. **Starter content.** New accounts are seeded with a neutral sample workspace (a CV, a few Apply cards, a starter Thread) so the product demos itself — never the demo persona.

**Not in this spec:** real Coach LLM (the stub reply moves server-side unchanged), OAuth/passkeys, email verification provider (links are logged; Resend is a follow-up), Pitch persistence (stays client-side seed), Fit score visibility (column exists, hidden from DTOs — PRODUCT.md q1 still open), custom domains.

## Route to real product (updates the Spec 3 table)

| Spec | Scope | Status |
|------|-------|--------|
| 3 — App shell | Shell, Home Coach (stub), Search, History, Settings, stub surfaces | Done |
| 3.9 — Craft surfaces client-side | Paper/Apply/Pitch ported from the frozen prototype, client state (QVE-110–113) | In flight |
| **4 — Auth + Data (this spec)** | Accounts, Postgres, Command registry, server Threads, Paper + Apply persistence | This spec |
| Coach (unnumbered) | Real LLM, streaming, Commands wired as tools from the same registry | After 4 |
| Pitch persistence | One jsonb doc per user | After 4, unblocked |
| Later | Email provider + verification, sibling custom domains, OAuth, notification inbox, Connected apps | — |

## User Stories

1. As a **User**, I want to create an account with email and password, so that my work is mine.
2. As a **User**, I want to sign in and land where I left off, so that returning feels like continuing, not starting over.
3. As a **signed-out visitor**, I want to see only sign-in/sign-up, so that nobody browses a stranger's workspace.
4. As a **User**, I want my Threads with the Coach to survive reloads, sign-outs, and other devices, so that the conversation is a record, not a mood.
5. As a **User**, I want History and Search to keep showing my Threads on every surface, so that the shell behaves as before — just truthfully.
6. As a **User**, I want my Paper docs (CVs, Letters, Proofs) saved as I edit, so that closing the tab costs nothing.
7. As a **User**, I want my Apply cards to hold their stage and order, so that the board reflects my actual pipeline.
8. As a **User**, I want a sample workspace on first sign-in, so that I can see what the product does before I've made anything.
9. As a **User**, I want Settings → Account to show my real identity with a working sign-out, so that the placeholder era ends.
10. As the **Coach (future)**, I want every product mutation to exist as a registered Command with authorization and honesty flags, so that when I act, I act exactly as the User could — and never claim otherwise.
11. As an **agent maintaining the system**, I want migrations committed as SQL and applied automatically before each deploy, so that schema changes are reviewable, testable, and boring.

## Decisions

Technical decisions live in **ADR-0006** (Drizzle, commands endpoint, jsonb content, UUIDv7, fractional ordering, cookie specifics, migration home). Product decisions locked here:

- **Hard gate:** the entire app requires sign-in. A public landing page is future work, not this spec.
- **Starter content on signup**, neutral voice, wipeable; production never shows the demo persona (closes PRODUCT.md open q. 4 for real accounts).
- **Fit stays hidden** (q1 open): stored, never in DTOs or UI.
- Threads' sessionStorage data is **not migrated** — it is demo seed by construction; the key retires.

## Ticket breakdown (tracer bullets)

Eight tickets under one parent, blocking edges as listed; each lands green and demoable. 1 → 2 → {3, 4} → 5; 4 + QVE-111 → 6; 6 + QVE-112 → 7; {5,6,7} → 8 (seeds, ADR cross-links, docs sync, follow-up tickets). The parent carries the standard verification protocol: a fresh agent verifies every criterion when children close.

## Definition of done

- [ ] Sign-up → sign-in → sign-out round-trip works on production (Vercel ↔ Railway, cross-origin cookies)
- [ ] Signed-out visitors can reach only sign-in/sign-up; every surface route redirects
- [ ] Threads, Paper docs, and Apply cards persist across reload, sign-out/sign-in, and devices
- [ ] All mutations flow through `POST /api/commands/:name`; no other write path exists
- [ ] `GET /health` serves 200 with no database configured (invariant test)
- [ ] Migrations apply from scratch in CI (pglite) and via Railway preDeploy on both environments
- [ ] `fit` appears in no API response and no UI
- [ ] New account shows neutral starter content; demo persona appears nowhere
- [ ] Dev-profile placeholder (`VITE_DEV_PROFILE_*`, `dev-profile.ts`) deleted
- [ ] ADR-0005 marked superseded by the shipped `ThreadListPort`; ADR-0006 committed; docs synced
