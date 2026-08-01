# QA final: closing quality gate (RDS-990)

The closing quality gate over the whole product after tickets 25 through 33
(RDS-984 through RDS-994): landing page, candidate mode, recruiter mode,
every AI workflow. Method: read `CONTEXT.md`, `docs/architecture.md`,
`docs/design.md`, `docs/lessons.md`, `docs/delivery-map.md`, and `qa-16.md`
first, then walked every major journey in a real headless Chromium session
against the dev server (route crawl, squeeze checks, and scripted
interaction runs), swept the repository for dead code and stale docs, fixed
what the audit found, and re-verified. Same style as `qa-16.md`: each item
is checked off once verified or fixed. This is a much larger surface than
`qa-16.md` covered (9 more tickets, a second persona mode, a public landing
page), so items are grouped by surface rather than by the nine original
flows.

## 1. Route crawl and console/page-error sweep

Every reachable route loaded at 1440x900 in a fresh browser context, with a
console-error and page-error listener attached, plus a check for the
Next.js error-overlay text. 37 URLs: every sidebar nav route in both modes,
all 10 seeded opportunity detail pages, all 3 seeded CV detail pages, 3
seeded recruiter candidate detail pages, the compare workspace with a real
`?ids=` query, and 3 invalid-id direct URLs.

- [x] `/` (landing), `/onboarding`, `/home`, `/opportunities`: clean.
- [x] `/opportunities/opp-1` through `/opportunities/opp-10` (all 10 seeded
      opportunities): clean.
- [x] `/opportunities/compare?ids=opp-1,opp-3,opp-5`: clean.
- [x] `/opportunities/does-not-exist`: designed not-found state, no crash.
- [x] `/strategy`, `/sources`, `/rewind`, `/profile`: clean.
- [x] `/cvs`, `/cvs/cv-1`, `/cvs/cv-2`, `/cvs/cv-3`: clean.
- [x] `/cvs/does-not-exist`: designed not-found state, no crash.
- [x] `/proof`, `/planner`, `/roadmap`, `/goals`, `/skills`,
      `/track-record`: clean.
- [x] `/recruiter`, `/recruiter/roles`, `/recruiter/candidates`: clean.
- [x] `/recruiter/candidates/rc-1`, `rc-3`, `rc-8`: clean.
- [x] `/recruiter/candidates/does-not-exist`: designed not-found state, no
      crash.
- [x] Zero console errors, zero page errors, zero error-overlay text across
      all 37 routes. Zero server-side errors or warnings in the dev server
      log across the whole audit run (checked after every scripted
      interaction pass, not just the crawl).

## 2. Squeeze check: 1440 and 1280-with-Copilot-panel-open

Per the standing check every ticket since lesson #22 has used: horizontal
overflow (`document.documentElement.scrollWidth - clientWidth`) measured at
1440px and again at 1280px with the Copilot panel opened via the header
toggle, across every dense/grid-heavy surface plus a general sweep.

- [x] `/home`, `/opportunities`, `/strategy`, `/sources`, `/rewind`,
      `/profile`, `/cvs`, `/proof`, `/planner`, `/roadmap`, `/goals`,
      `/skills`, `/track-record`, `/recruiter`, `/recruiter/roles`,
      `/recruiter/candidates`: 0px overflow at both widths.
- [x] `/opportunities/compare?ids=opp-1,opp-3,opp-5`: 0px overflow at both
      widths.
- [x] All 10 opportunity detail pages, `/cvs/cv-2`, `/cvs/cv-3`, and 3
      recruiter candidate detail pages: 0px overflow at both widths, after
      the fix in section 3 below.
- [ ] ~~`/opportunities/opp-1` at 1280px with the Copilot panel open~~:
      **found broken, fixed.** See section 3, item 1.

## 3. Product cleanup: defects found and fixed

- [x] **Copilot panel header overflow at the 1280-plus-panel squeeze on a
      long opportunity title.** `components/shell/copilot-panel.tsx`'s
      header wrapped its context `Chip` in a `flex flex-col gap-1.5` div
      with no `min-w-0`, inside the docked `aside`'s fixed `w-[360px]` row.
      A long role-and-company title ("Staff Product Designer, AI Platform
      at Solace AI") pushed the chip 66px past the panel's own edge and
      into page-wide horizontal overflow; `Chip`'s own `min-w-0 truncate`
      span (the lesson #42 fix) never got the chance to activate because
      nothing upstream of it was allowed to shrink. Fixed by adding
      `min-w-0` to the header's flex-col wrapper and `max-w-full` to the
      `Chip`. Re-verified: 0px overflow on all 10 opportunity detail pages
      and every other route re-checked at the same squeeze. See
      `docs/lessons.md` lesson 75 for the full diagnosis.
- [x] No other UX-law violations found on recurring components (Hick,
      Miller, Proximity, Progressive Disclosure, Jakob, Aesthetic-Usability)
      beyond the one above. Every checklist from the 9 prior tickets'
      `docs/lessons.md` entries (lessons 40, 43, 46, 49, 52, 57, 61, 68, 74)
      was spot-verified live during this pass's own walkthrough, not just
      re-read, and held.
- [x] No copy drift found from the copy pass (RDS-978, `docs/lessons.md`
      lessons 18-20): spot-checked scripted Copilot copy for first-person
      leaks (`I'll`, `I've`, `I'm`) across the surfaces added since (Proof
      Builder, Strategy, recruiter mode's two Copilot surfaces) and found
      none; every accept/dismiss toast checked during the interaction runs
      below names the specific change, not a generic "Suggestion accepted."
- [x] No weak or missing empty states found beyond what qa-16 already fixed.
      Track Record's "For your review" queue (the one qa-16 previously had
      to fix) still shows its designed empty state once fully drained; see
      section 5.

## 4. State verification: save-back, Undo, empty states, new objects

Scripted interaction runs in a real headless browser, using in-app
navigation between steps (not `page.goto()`) per `docs/lessons.md` #17, so
session state (connected sources, links, decisions) carries correctly
between steps.

- [x] Home: approving a proposed AI signal shows a save-back naming the
      change, with a working Undo.
- [x] Opportunities: Active/Watchlist mode switch works; the Add dialog
      opens, accepts a long pasted description (2823 characters) without
      breaking page layout, and closes on Escape.
- [x] Compare: "Make this my focus" shows a named save-back with Undo;
      Undo restores the prior state.
- [x] Strategy: approving a weekly focus move shows a named save-back with
      Undo; Undo works.
- [x] Proof Builder: Accept on a transformation shows a named save-back
      with Undo.
- [x] Sources: the Connect dialog opens and steps through its simulated
      3-step flow; accepting a suggested link on an inbox row shows a named
      save-back ("Linked to Solace AI") with Undo.
- [x] Rewind: Save on a candidate works; Dismiss shows a working Undo.
- [x] Track Record: dismissing both seeded candidates (`tre-11`, `tre-12`)
      drains the "For your review" queue to its designed empty state
      ("Nothing drafted for review right now. Copilot will surface new
      candidates from recent activity."), not a blank section, consistent
      with the fix qa-16 made for this exact queue.
- [x] CV tailoring: "Tailor for this role" from an opportunity's Materials
      tab opens the tailoring dialog, accepting a suggestion and saving
      completes without error; the CV Versions list still renders correctly
      afterward.
- [x] Copilot: a suggested prompt on Home and on Strategy each produce a
      scripted answer in the panel.
- [x] Planner: accepting a pinned next move ("Add to plan") works.
- [x] Roadmap: "Add to plan" on a milestone resource works.
- [x] Profile: editing the summary with a long unbroken word (350
      characters, no spaces) does not overflow the page (0px); saving shows
      a save-back confirmation.
- [x] Recruiter: mode switch candidate to recruiter and back both work via
      the persona chip dropdown on both sidebars, landing on `/recruiter`
      and back on `/home` respectively.
- [x] Recruiter: the Hold decision dialog requires and accepts a reason,
      then shows a save-back naming that reason with Undo.
- [x] Recruiter: an outreach draft's "Mark as sent" updates its status.
- [x] Recruiter: an Interview-stage candidate's submission packet prepares
      and shares, each with its own confirmation.
- [x] Refresh mid-flow: reloading with the Add-opportunity dialog open on
      `/opportunities`, and reloading mid-onboarding-step, both return to a
      clean, non-broken initial view for the route, no crash, no partial
      render, consistent with the prototype's no-persistence design.

## 5. Below-1024 guard and direct URLs

- [x] The guard renders at 1023px and below, and does not render at 1024px
      and above, on every app route tested (`/home`, `/opportunities`,
      `/onboarding`, `/strategy`) and on recruiter mode (`/recruiter`).
- [x] The landing page (`/`) never shows the guard, at any width tested
      (1440, 1024, 900, 390, 320), and has 0px horizontal overflow at every
      one of those widths.
- [x] Direct URLs to a nonexistent opportunity, CV, and recruiter candidate
      each show a designed not-found state with a way back, no crash (see
      section 1).

## 6. Repository cleanup

Prove-before-removing pass over `git diff --stat 1224821..HEAD` plus
`ts-prune`, per `docs/lessons.md` lesson #33's warning that a naive grep can
wrongly flag a type used only through an inferred return type, and this
pass's own lesson 76 that a barrel re-export file needs the same care.

- [x] **Dead export removed:** `recruiterSourceLabel`/`SOURCE_LABEL` in
      `lib/recruiter-utils.ts`. Confirmed via repo-wide grep: the function
      was never called anywhere; its intended consumer
      (`components/recruiter/recruiter-source-chip.tsx`) renders the raw
      `RecruiterSource` string directly instead, and the backing map was an
      identity map, so nothing behavioral changes.
- [x] **Orphan file removed:** `components/ui/input-group.tsx`. Confirmed
      via repo-wide grep for both the file path and every one of its
      exports (`InputGroup`, `InputGroupAddon`, `InputGroupButton`,
      `InputGroupText`, `InputGroupInput`, `InputGroupTextarea`): zero
      references anywhere. Predates this range (vendored before commit
      1224821), not something RDS-984 through RDS-994 introduced.
- [x] **`ts-prune` re-run after both removals:** the only remaining flags
      are `lib/store/index.tsx`'s 10 barrel re-exports, confirmed false
      positives (`useStore` alone is imported by 109 files through
      `@/lib/store`), plus Next.js route-convention `default` exports and
      the "used in module" inferred-type cases lesson #33 already covers.
      Nothing else dead found.
- [x] **Stale doc references fixed:**
      - `docs/delivery-map.md` sections 15 (RDS-973) and 18 (RDS-976)
        pointed at `components/home/attention-queue.tsx` and
        `next-actions-card.tsx`, both deleted by RDS-993. Annotated both
        entries to say so and point at the new section 30 (RDS-993).
      - `docs/architecture.md` section 3 and `docs/design.md` section 5's
        matching page-template tables were missing `/opportunities/compare`
        (RDS-985) and all of `/recruiter`, `/recruiter/roles`,
        `/recruiter/candidates` (RDS-988) from the `WorkspacePage` row, and
        `/recruiter/candidates/[id]` (RDS-988) from the `DetailPage` row.
        Fixed both tables; added the same two routes to
        `docs/architecture.md`'s drill-downs list.
      - `docs/design.md`'s "Semantic status colors" and "chip color map"
        undercounted `ChipTone` by one: `components/shared/chip-tones.ts`
        defines 5 tones (`success`, `warning`, `danger`, `neutral`,
        `muted`), the doc only named 4 and folded `muted`'s distinct
        no-hue meaning into the `neutral` row. Split the row and named the
        fifth tone explicitly.
- [x] `docs/delivery-map.md` extended with sections 25 through 34, covering
      the 9 RDS tickets that shipped commits since 1224821 (984 through
      989, 991, 993, 994, in the order they actually shipped) plus this
      ticket (RDS-990) itself as the closing section, same verified format
      as sections 01 to 24.
- [x] `docs/lessons.md` left consistent: this pass's own entry appended
      (2026-08-01, RDS-990 closing quality gate), no dangling references
      introduced.

## 7. Final gate and delivery summary

**What was reviewed:** every route in both candidate and recruiter mode (37
URLs including invalid-id direct links), every save-back-and-Undo flow
listed in section 4, the below-1024 guard and the landing page's exemption
from it, refresh-mid-flow, long-input-text handling, and the 1440/1280-
with-panel width pair on every dense surface. The repository itself: dead
exports, one orphan file, and doc accuracy against the current code, for
everything shipped since the last hygiene pass (RDS-981, commit 1224821)
through RDS-994.

**What was cleaned:** one real layout defect (the Copilot panel header
overflow, section 3), one dead export, one orphan file, and the stale doc
references in section 6. `docs/delivery-map.md` now covers RDS-959 through
RDS-994 without a gap.

**What stays intentionally prototype-only:** everything `docs/architecture.md`
section 2 already commits to and this pass re-confirmed still holds: no
backend, no persistence, no real AI calls, state resets on reload by
design, desktop web only for the app shell (the landing page is the one
documented exception), scripted "thinking" delays instead of real latency,
and every AI-authored change going through the trust boundary (draft,
never auto-apply). None of this needed a fix; it needed re-confirming that
9 more tickets hadn't quietly broken it, and they hadn't.

**Caveats for future work:** the transient over-cap behavior Home's
decision queue accepts during a rapid multi-approval burst
(`docs/lessons.md` lesson 54) and the "+N more" overflow link's scope gap
(lesson 57) are both documented, deliberate tradeoffs, not defects, and
still apply unchanged. `docs/design.md`'s indigo rule doesn't explicitly
name the weekly completion-card pattern (Rewind's `completion-card.tsx`,
Strategy's `strategy-plan-completion-card.tsx`) as a sanctioned indigo
exception even though both predate this pass and use it consistently with
each other; worth a human call on whether to document it explicitly or
tighten it, not resolved here since it wasn't a regression this pass
introduced or found broken. No other open questions.

**Final verification:** `npm run lint`, `npx tsc --noEmit`, and
`npm run build` all pass with zero errors. A final full walkthrough after
all fixes (landing page through onboarding through the workspace, the
decision queue, Opportunities in both lenses plus compare, Strategy,
Sources, Rewind, Track Record, Profile, CVs, Proof Builder, Planner,
Roadmap, Goals, Skills, the Copilot on multiple surfaces, recruiter mode
end to end, mode switching both directions, and every direct URL tested
above) produced zero console or page errors and zero dev-server errors.
