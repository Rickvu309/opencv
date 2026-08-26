# Spec 3: App shell

**Status:** Ready for ticket breakdown
**Linear project:** OpenPath (team QVE)
**Spec lives on:** `main` → `docs/specs/spec-3-app-shell.md`
**Decision record:** ADR-0004 (shell pattern), `PRODUCT.md` (prototype PRD), `CONTEXT.md` (vocabulary)
**Related research:** `docs/research/2026-08-21-spec3-auth-and-app-shell.md` (auth deferred to a later spec)

Spec 3 is the **first productionization spec** of the validated app-shell prototype. It ships the shell with stub craft surfaces; the Route to real product section below charts everything else the prototype proved.

---

## Prototype reference (frozen)

The prototype is the visual and interaction reference. It is **frozen** at commit `3496338` on `prototype/app-shell` — bugfixes to reference UX only, no production code.

- **Branch:** `prototype/app-shell` @ `quanvu309/openpath` (pushed 2026-08-24)
- **Live preview:** https://openpath-git-prototype-app-shell-rickvudev.vercel.app/prototype/app-shell
- **Local worktree:** `/Users/quanvu/openpath-prototype-app-shell`
- **Module paths:** `apps/web/src/prototype/app-shell/` on that branch — **not** on `main`

## Repository and worktrees

Spec 3 work spans **two git contexts**. Do not mix them.

| Context | Path | Branch | Role |
|---------|------|--------|------|
| **Main (production)** | `/Users/quanvu/OpenPath` | `main` | Spec, ADRs, **Spec 3 implementation**, merges |
| **Prototype (reference)** | `/Users/quanvu/openpath-prototype-app-shell` | `prototype/app-shell` | **Read-only UX reference** — do not implement Spec 3 here |

### Implementation rules

1. **Port, don't symlink** — copy patterns from prototype into production modules on `main` (`apps/web/src/routes/`, `apps/web/src/features/app-shell/`, or similar). Do not import from `@/prototype/…` in production routes.
2. **Prototype branch stays frozen** — reference only.
3. **Tickets branch from `main`** — per `AGENTS.md`: one Linear ticket → one branch (any name) → one PR that references the QVE id; optional worktree per ticket. CI green and a review verdict before a human squash-merges.
4. **Agents read reference files from the prototype worktree, the branch on GitHub, or the live preview** — they are not on `main`.

---

## Problem Statement

OpenPath targets Vietnamese early-career Users in short, anxious sessions. They need a product with clear places for **Paper** (CVs, Letters, Proofs), **Apply** (pursuit tracking), **Pitch** (shareable portfolio), and the **Coach** (direction and next steps) — without rebuilding layout on every future spec.

Today the production app (`apps/web`) is a minimal scaffold: a marketing-style home page and health check. There is no app chrome.

The prototype validated the whole product surface — shell **and** full Paper / Apply / Pitch workspaces (see `PRODUCT.md`). Spec 3 productionizes the foundation: the shell with real routes and stub craft surfaces, matching the prototype so Spec 4+ drops real surfaces into the main pane without re-litigating layout.

**Authentication is not part of Spec 3.** Sign-up, sign-in, sessions, and route protection ship in a separate spec later.

## Solution

Deliver the **app shell** in production that:

1. Replicates the validated **P1 `GrokStyleShell`** (ADR-0004): collapsible sidebar, primary nav (Home, Search, Paper, Apply, Pitch), History, profile footer → Settings.
2. Implements **Home** as the Coach entry point: idle state (greeting, suggestion chips, composer, connect-apps affordance) and active chat state (Thread + composer).
3. Opens **Paper, Apply, Pitch, and Settings** as **stub workspaces** — correct chrome and routing, placeholder content only. Stub copy describes each surface per `CONTEXT.md` (Pitch = shareable portfolio).
4. Provides **Search modal** (⌘K / sidebar Search) to jump surfaces and start a new chat.
5. Keeps the **Coach honest**: no fake Commands, no claims that product state changed. Stub replies only until a later spec wires real Coach + Commands (ADR-0003).

---

## Route to real product

The prototype proved more than Spec 3 shipped. Numbering below matches the live specs (`docs/specs/spec-4-auth-and-data.md`). Nothing is orphaned.

| Spec | Scope | Status |
|------|-------|--------|
| **3 — App shell** (this spec) | Shell, Home Coach (stub replies), Search, History, Settings tabs, stub surfaces | Done |
| **3.9 — Craft surfaces client-side** | Paper / Apply / Pitch ported from the frozen prototype (QVE-110–113) | Done |
| **4 — Auth + Data** | Accounts, Postgres, Command registry, server Threads, Paper + Apply persistence, signup starter | Done |
| **5 — The Coach** | Real LLM, streaming, Commands wired as tools from the same registry | Done (QVE-136 / QVE-137–144); `OPENROUTER_API_KEY` on Railway is the remaining owner step |
| **6 — Design system** | Tokens, kit consumption, vocabulary lock | Done (QVE-156 / QVE-157–159) |
| **7 — Coach experience** | One dock, Thread `focus_doc_id`, visible editing, calm motion | Done (QVE-168 / QVE-169, 172, 170, 173, 174) |
| **8 — Paper Coach shell** | Hideable docs panel, floating `CoachFloat`, must-edit CV, assistant-ui — `docs/specs/spec-8-paper-coach-shell.md` | Ready ([QVE-175](https://linear.app/quanvm/issue/QVE-175)) |
| **Pitch persistence** | One jsonb document per user (same shape as Paper content) | After 8, unblocked |
| **Later** | Email provider + verification, sibling custom domains, OAuth, notification inbox, Connected apps, voice input | — |

Ticket writers start from this table plus `PRODUCT.md` and ADR-0006.

**Sequencing note (2026-08):** Craft surfaces shipped client-side first (QVE-110–113), then Spec 4 persisted Paper / Apply / Threads and gated the app. This supersedes the earlier “Specs 4–6 blocked by 3.5” ordering and the old Paper/Apply/Pitch spec numbers.

---

## User Stories

### App shell — layout and navigation

1. As a **User**, I want a persistent sidebar with the OpenPath logo, so that I always know where I am.
2. As a **User**, I want to collapse and expand the sidebar, so that I get more space for craft surfaces when needed.
3. As a **User**, I want primary nav items for Home, Search, Paper, Apply, and Pitch, so that I can reach each surface in one click.
4. As a **User**, I want the active nav item visually highlighted, so that I know which surface is open.
5. As a **User**, I want Apply to show a subtle activity indicator (badge), so that pursuit work feels alive (prototype pattern).
6. As a **User**, I want a History section in the sidebar listing recent Threads, so that I can resume prior conversations.
7. As a **User**, I want History to collapse/expand and support "See all" when there are many Threads, so that the sidebar stays scannable.
8. As a **User**, I want my profile avatar and name at the bottom of the sidebar, so that I can open Settings.
9. As a **User**, I want the main content area to fill remaining viewport height, so that craft surfaces and Home use space efficiently.
10. As a **User**, I want the shell to work at common laptop widths (~1280px) and degrade gracefully on narrower viewports, so that mobile web is usable even if not pixel-perfect.

### Home — idle state

11. As a **User**, I want a time-of-day greeting with my name on Home, so that the product feels personal.
12. As a **User**, I want suggestion chips that fill the composer when tapped, so that I can start quickly when anxious.
13. As a **User**, I want a multi-line composer with send on Enter and Shift+Enter for newline, so that messaging feels natural.
14. As a **User**, I want a composer "+" menu with attach/upload affordances (stub actions OK), so that the shell matches the validated prototype shape.
15. As a **User**, I want a "Connect apps" row on Home, so that integrations are discoverable (opens Settings → Connected apps).
16. As a **User**, I want sending a message to switch Home into chat mode, so that conversation takes over the main pane.

### Home — active chat

17. As a **User**, I want to see my messages and Coach replies in a scrollable Thread, so that I can read the conversation.
18. As a **User**, I want a thinking/loading state while the Coach responds, so that I know something is happening.
19. As a **User**, I want the composer pinned at the bottom in chat mode, so that I can continue the Thread.
20. As a **User**, I want Coach replies to be **stub text** that does not claim to have edited Paper or Apply, so that the product stays honest until Commands exist.
21. As a **User**, I want opening a History item to restore that Thread in Home, so that I can continue earlier conversations.
22. As a **User**, I want "new chat" to clear the current Thread and return to idle Home, so that I can start fresh.

### Search

23. As a **User**, I want to open Search with ⌘K (Ctrl+K on Windows), so that power users can navigate quickly.
24. As a **User**, I want Search from the sidebar nav item, so that mouse users have the same capability.
25. As a **User**, I want Search to list quick actions (new chat, open Paper, open Apply, open Pitch), so that I can jump without the sidebar.
26. As a **User**, I want Search to filter recent Threads by title, so that I can find past conversations.
27. As a **User**, I want Escape to close Search, so that keyboard flow is smooth.

### Stub craft surfaces

28. As a **User**, I want Paper to open inside the shell with a clear title and short description (CVs, Letters, Proofs — per `CONTEXT.md`), so that I understand the destination is coming.
29. As a **User**, I want Apply to open as a stub with the same pattern, so that navigation is consistent.
30. As a **User**, I want Pitch to open as a stub describing the shareable portfolio, so that navigation is consistent.
31. As a **User**, I want stub surfaces to use the full main pane (not a modal), so that Spec 4+ can replace content in place.

### Settings

32. As a **User**, I want Settings to open inside the shell, so that I do not lose navigation context.
33. As a **User**, I want Settings tabs for General, Connected apps, and Account, so that settings match the prototype structure.
34. As a **User**, I want Account to show a placeholder profile (name, email stub), so that the layout is ready for auth later.
35. As a **User**, I want Connected apps to show a catalog stub (no real OAuth in Spec 3), so that the layout is ready for later integration.

### Routing and deep links

36. As a **User**, I want each surface to have a stable URL, so that refresh restores the same view.
37. As a **User**, I want the app root to default to Home, so that the Coach entry point is the landing experience.
38. As a **User**, I want browser back/forward to work between surfaces, so that navigation feels native.

### Explicit non-goals (user-visible)

39. As a **User**, I do **not** need Projects in the sidebar (ADR-0004), so that the shell stays simple.
40. As a **User**, I do **not** need real CV editing, Apply kanban, or Pitch publishing in Spec 3 — those are Specs 4–6 — so that the team ships the foundation first.
41. As a **User**, I do **not** need to sign in for Spec 3, so that shell work is not blocked on auth.

---

## Implementation Decisions

### 1. Shell pattern — locked by ADR-0004

**Decision:** Ship **P1 `GrokStyleShell`** from the prototype. Left sidebar (~15rem expanded, ~3.5rem collapsed), border-right, full viewport height; main column `min-w-0 flex-1`; Home is the default surface; craft surfaces swap the main pane. No Projects.

```typescript
type SurfaceId = "home" | "paper" | "apply" | "pitch" | "settings"
```

### 2. No authentication in Spec 3

- App routes are **public** for now.
- Profile name/avatar uses a **dev placeholder** (configurable constant or env) — never the "Eric Nguyen" demo persona (PRODUCT.md open q. 4).
- Settings → Account shows stub fields; Sign out is **hidden or disabled** with "Coming soon" — not a fake working sign-out.
- Existing `/health` smoke path unchanged.

### 3. Routing — TanStack Router nested layout

App layout route renders the shell and an `<Outlet />` for child routes.

| URL | Surface | Content |
|-----|---------|---------|
| `/` or `/app` | home | Home dashboard (pick one root; redirect the other) |
| `/app/paper` | paper | Stub |
| `/app/apply` | apply | Stub |
| `/app/pitch` | pitch | Stub |
| `/app/settings` | settings | Settings workspace (tabs stub) |

Search params for Settings tab (`?tab=apps`) optional; prototype uses in-shell tab state.

### 4. Module boundaries (production)

| Module | Responsibility |
|--------|----------------|
| `apps/web` app layout | Sidebar, nav state, History, Search modal, profile |
| `apps/web` home | Idle + chat modes, composer, suggestions |
| `apps/web` surface stubs | `CraftStub`-equivalent per surface |
| `apps/web` settings shell | Tabs; apps catalog stub; Account placeholder |

**Do not** port `paper-workspace`, `apply-workspace`, or `pitch-workspace` in Spec 3 — Specs 4–6 (see roadmap).

### 5. Home Coach behavior (Spec 3)

Client-side Thread state only (in-memory; optional `sessionStorage` for refresh — nice-to-have). Coach reply: stub — fixed helpful text that does not claim craft actions; must **not** violate ADR-0003. Message actions (copy, thumbs, regenerate) may render as **disabled or no-op**.

### 6. History and Search data

Seed demo Threads acceptable for demo/dev; client state only. No server persistence in Spec 3 (Spec 3.5).

### 7. Design system and UI kit — the porting rule

`packages/ui` now holds the shipped shell kit: `button`, `input`, `avatar`, `badge`, `tooltip`, `dropdown-menu`, `dialog`, `tabs`. There is **no `card`** — absorb it when a later ticket needs it (ADR-0002). The prototype otherwise used raw Tailwind + `lucide-react`.

Production `packages/ui/src/styles/globals.css` is the shadcn/Tailwind theme scaffold (tokens, `@theme`, light/dark). The prototype's 156-line Paper CV/A4 utilities (`.cv-*`, `.paper-editor-canvas`, `.bg-stripes`) were **not** ported and are **not** in production CSS. They stay on the prototype branch and land with Spec 4.

**Decision:** per ADR-0002, absorb the shadcn components a ticket needs **as part of that ticket** (`pnpm dlx shadcn@latest add <name> -c apps/web`), rather than one big kit-first ticket. The shell already absorbed `dialog` (Search), `tabs` (Settings), `avatar`, `badge`, `tooltip`, `dropdown-menu`. Structural layout may stay raw Tailwind matching the prototype.

Match prototype spacing, typography, and interaction — sidebar width, nav density, composer shape, Home greeting style should be recognizably the same product (compare against the live preview).

---

## Testing Decisions

### What makes a good test

Test **observable behavior** at the highest stable seam: routes and navigation — not internal React state or class names.

### Primary test seam

**Web layout integration:** navigate Home → Paper → Home; assert correct stub titles and active nav state. No auth guard tests in Spec 3. Prefer one layout integration test over many shallow component tests.

### Prior art

- `apps/web/src/routes/home.test.tsx` (covers Home idle — Coach greeting, suggestion chips, composer, + menu, Connect apps)
- `apps/api/src/app.test.ts` (unchanged; `/health` only)

### Manual acceptance (prototype parity)

Compare production side-by-side with the live preview at 1280px: sidebar collapse · nav highlights · Home idle → send → chat mode · ⌘K search actions · History open Thread · Settings tabs · stub Paper / Apply / Pitch.

---

## Out of Scope for Spec 3

Everything below **exists in the prototype** and is productionized by a later spec (see Route to real product):

- **Craft surfaces (Specs 4–6):** Paper CV editor / templates / Proof / Letters / AI chat; Apply kanban / calendar / DnD / job detail / Fit; Pitch portfolio / stories / publish / GitHub heatmap.
- **Data + Commands (Spec 3.5):** persistence, Command registry, real Opportunity CRUD.
- **Auth spec:** sign-up/in/out, sessions, protected routes, real Account tab.
- **Coach spec:** real LLM, streaming, server Threads, Commands (ADR-0003).
- **Later:** notification inbox, Connected apps OAuth, voice input, project tag in composer, file upload / RAG.

Not in the prototype and still out: Search/job-board discovery, social post publishing, i18n (ADR-0008), merging the prototype branch wholesale.

---

## Further Notes

### Prototype reference index

Paths relative to `apps/web/src/prototype/app-shell/` on `prototype/app-shell` (commit `3496338`).

| Spec 3 area | Prototype module(s) | What to match | What NOT to port |
|-------------|---------------------|---------------|------------------|
| Shell layout + sidebar | `grok-shell.tsx` (entry: `variants-mix.tsx` → `GrokStyleShell`) | Collapse, nav order, History, profile footer | Other variants (p2–p5, mix-bookshelf, variant-a*) |
| Route / surface switching | `../../routes/prototype-app-shell.tsx`, `shared.tsx` | `SurfaceId`, URL surface mapping, `CraftStub` | Full craft workspaces |
| Home idle | `home-dashboard.tsx`, `home-suggestions.tsx`, `home-top-bar.tsx` | Greeting, chips, composer placement | Eric hardcoding |
| Home chat | `chat-thread.tsx`, `chat-top-bar.tsx` | Thread, thinking state | — |
| Composer | `composer.tsx` | Multiline, + menu, send | Project menu item |
| Search | `search-modal.tsx` | ⌘K, actions, recents | — |
| Settings shell | `settings-workspace.tsx`, `apps-catalog.tsx`, `connected-apps.tsx` | Tabs, apps grid, connect row | Fake sign-out, real OAuth |
| Profile footer | `nav-profile.tsx` | Avatar + name button | — |
| Logo / brand | `logo.tsx`, `brand-icon.tsx`, `apps/web/public/openpath-mark.svg`, `public/brands/` | Sidebar brand, brand icons | — |
| Stub surfaces | `shared.tsx` (`CraftStub`, `SURFACE_COPY`) | Title + description pattern | Stale stub copy — rewrite per `CONTEXT.md` |

**Spec 4+ references** are indexed in the Route to real product table.

### Suggested ticket breakdown (for `/to-tickets`)

| Order | Ticket | Blocked by |
|-------|--------|------------|
| 1 | App layout route + surface routing (`home.test.tsx` now covers Home idle, not the old marketing home) | — |
| 2 | Sidebar + nav + collapse | 1 |
| 3 | Home idle (greeting, suggestions, composer) | 1 |
| 4 | Home chat mode + History (client state) | 3 |
| 5 | Search modal (⌘K) | 1 |
| 6 | Surface stubs (Paper, Apply, Pitch) | 1 |
| 7 | Settings shell (tabs stub) | 1 |
| 8 | Polish: responsive, a11y, prototype parity checklist | 2–7 |

Each ticket: **implement from `main`** (any branch name, one PR referencing the QVE id); **reference** the prototype worktree/preview; description must name both paths and the needed UI-kit absorptions (Decision 7).

### Definition of done (Spec 3)

- [ ] App shell matches prototype parity checklist (sidebar, Home, Search, History, Settings)
- [ ] Paper / Apply / Pitch open as stubs inside shell with `CONTEXT.md`-aligned copy
- [ ] Coach does not fake Commands
- [ ] No auth required to use the app
- [ ] Layout integration test covers surface navigation
- [ ] No `@/prototype/…` imports in production routes
- [ ] Prototype branch untouched (still frozen at `3496338`)

---

## Seam check

**Highest test seam:** app route tree — one layout integration test proving surface navigation and active nav state. No auth seam in Spec 3.
