# Delivery map

An index for the next reviewer: what each ticket from RDS-959 through RDS-983
actually shipped, where it lives, and what was intentionally simplified or
simulated. Built from `git log` and verified against the current code as
part of RDS-981's hygiene pass, not from ticket descriptions alone. Sections
are numbered 01 to 24, one per RDS ticket number in that range; see the note
on RDS-979 and the footnote on RDS-992 below.

For the product-level model (object types, flows, the simulated-AI rules),
read `docs/architecture.md` first. This file is the "which ticket built
which file" cross-reference; it does not restate the rules.

## 01, RDS-959: Architecture and domain doc

Wrote the prototype's foundation: the domain vocabulary (Opportunity, Fit,
Copilot, trust boundary) and the structural plan every later ticket built
against.

- Surfaces: none (docs only).
- Key files: `CONTEXT.md`, `docs/architecture.md`.
- Simplified: nothing to simplify, this is the plan, not the build.

## 02, RDS-960: Shell foundation, store, shared patterns

Scaffolded the app: domain types and Mai Tran's seed data, the shadcn/ui
component set, the store (React context plus reducer), the shared chip and
`ObjectCard` patterns, and the first desktop shell (sidebar, page header,
Copilot panel).

- Surfaces: the whole app shell (all routes render through it).
- Key files: `lib/types.ts`, `lib/data/persona.ts`, `lib/data/opportunities.ts`,
  `lib/data/cvs.ts`, `lib/data/goals.ts`, `lib/data/skills.ts`,
  `lib/data/track-record.ts`, `lib/data/nudges.ts`, `lib/data/actions.ts`,
  `lib/data/copilot-scripts.ts`, `lib/store.tsx` (now split into `lib/store/`,
  RDS-981), `components/shared/*`, `components/shell/sidebar.tsx`,
  `components/shell/copilot-panel.tsx`.
- Simplified: the shell and its nav were rebuilt on shadcn's Sidebar system
  later (see the RDS-992 footnote); the sidebar and desktop guard here were
  the hand-rolled first pass.

## 03, RDS-961: First-run onboarding

The full onboarding flow: welcome, role and location, target direction,
goals seed, mock profile import, landing on Home with a context banner.

- Surfaces: `/onboarding`.
- Key files: `app/onboarding/page.tsx`, `components/onboarding/*`
  (`onboarding-shell.tsx`, `steps/*`, `onboarding-data.ts`,
  `selectable-chip.tsx`).
- Simplified: "import profile" is a canned mock fill, no real import.

## 04, RDS-962: Opportunity intake

The Add-opportunity flow: paste-a-link-or-description with a simulated AI
parsing state, a structured preview the user edits, or manual entry.

- Surfaces: `/opportunities` (Add dialog).
- Key files: `components/opportunities/add-opportunity-dialog.tsx`,
  `lib/data/parse-samples.ts`.
- Simplified: "parsing" is a keyword match against `lib/data/parse-samples.ts`
  canned samples, not real extraction; every sample leaves one field
  unfilled on purpose so the preview can show a Copilot-suggests hint.

## 05, RDS-963: Opportunities workspace

Rebuilt Opportunities as a board and list workspace: view toggle, filters,
sort, quick status/priority/Dream actions, the focus strip.

- Surfaces: `/opportunities`.
- Key files: `components/opportunities/opportunity-board-view.tsx`,
  `opportunity-list-view.tsx`, `opportunities-controls.tsx`,
  `opportunities-focus-strip.tsx`, `opportunity-quick-actions-menu.tsx`,
  `lib/opportunity-utils.ts`.

## 06, RDS-964: Opportunity detail workflow

The opportunity detail page's tab scaffold (Overview, AI Analysis, Actions,
Materials, Activity) and the Overview/Activity/summary-band content.

- Surfaces: `/opportunities/[id]`.
- Key files: `app/(app)/opportunities/[id]/page.tsx`,
  `components/opportunities/opportunity-overview-tab.tsx`,
  `opportunity-activity-tab.tsx`, `opportunity-summary-band.tsx`,
  `lib/data/activity.ts`.

## 07, RDS-965: AI Analysis tab, three Copilot layers

Deepened the AI Analysis tab into interpretation ("what this role really
asks for"), credibility checks, and fit judgment, each a scripted,
object-specific insight block.

- Surfaces: `/opportunities/[id]` AI Analysis tab.
- Key files: `components/opportunities/opportunity-ai-analysis-tab.tsx`,
  `components/shared/expandable-row.tsx`, `why-this-reading.tsx`,
  `lib/data/insights.ts`, `lib/data/copilot-scripts.ts`.
- Simplified: credibility checks are seeded pass/fail verdicts on specific
  opportunities (opp-2 is the one deliberately low-credibility posting), not
  a real check against anything external.

## 08, RDS-966: Actions tab and Home decision support

Deepened the Actions tab and Home into a decision-support layer: one primary
recommended next action per opportunity with alternatives, rationale,
confidence, and accept/edit/dismiss.

- Surfaces: `/opportunities/[id]` Actions tab, `/home`.
- Key files: `components/opportunities/opportunity-actions-tab.tsx`,
  `lib/data/actions.ts`.

## 09, RDS-967: Profile page

Built Profile as a career context layer: headline, summary, strengths,
experience, preferences, target direction, plus a "what Copilot uses" card.

- Surfaces: `/profile`.
- Key files: `components/profile/*` (`profile-identity-band.tsx`,
  `profile-summary-card.tsx`, `profile-strengths-card.tsx`,
  `profile-experience-card.tsx`, `profile-preferences-card.tsx`,
  `profile-used-by-card.tsx`, `profile-copilot-uses-card.tsx`),
  `lib/profile-utils.ts`.

## 10, RDS-968: CV Versions and tailoring

The CV Versions workflow: create, duplicate, edit sections, link to an
opportunity, and "Tailor for this role" with per-section AI suggestions.

- Surfaces: `/cvs`, `/cvs/[id]`.
- Key files: `app/(app)/cvs/page.tsx`, `app/(app)/cvs/[id]/page.tsx`,
  `components/cvs/*` (`cv-meta-rail.tsx`, `cv-section-card.tsx`,
  `tailoring-dialog.tsx`, `new-cv-version-dialog.tsx`, `delete-cv-dialog.tsx`).

## 11, RDS-969: Track Record capture

The Track Record capture workflow: manual add, AI-drafted candidate review
queue (confirm or dismiss), and the confirmed timeline.

- Surfaces: `/track-record`.
- Key files: `components/track-record/entry-card.tsx`,
  `candidate-card.tsx`, `add-entry-dialog.tsx`,
  `confirm-candidate-dialog.tsx`, `entry-fields-form.tsx`,
  `lib/track-record-utils.ts`.

## 12, RDS-970: Goals page

Built out Goals (flow 8, goals half): the goal list, gap analysis against
target direction, path scenario cards, add/edit/park.

- Surfaces: `/goals`.
- Key files: `components/goals/goal-card.tsx`, `direction-band.tsx`,
  `gap-analysis-section.tsx`, `path-scenario-card.tsx`,
  `goal-form-dialog.tsx`, `lib/data/goals.ts`.

## 13, RDS-971: Skills & Learning

Upgraded Skills & Learning into a full skill map, gap insight against target
direction, and a learning plan (accept a learning item to plan).

- Surfaces: `/skills`.
- Key files: `components/skills/skill-map-section.tsx`, `skill-row.tsx`,
  `skill-level-meter.tsx`, `gap-insight-section.tsx`,
  `learning-plan-section.tsx`, `learning-item-card.tsx`,
  `lib/data/skills.ts`.

## 14, RDS-972: Unify the Copilot layer

Unified the Copilot panel across every surface: one context-aware panel,
per-surface suggested prompts and scripted exchanges, a consistent "Ask
Copilot" entry point.

- Surfaces: every route (the right panel).
- Key files: `components/shell/copilot-panel.tsx`,
  `components/shared/ask-copilot-button.tsx`,
  `lib/copilot-surface-names.ts`, `lib/copilot-utils.ts`,
  `lib/data/copilot-scripts.ts`.

## 15, RDS-973: Home proactive queue and Weekly Review

Turned Home into the proactive attention queue (nudges across opportunity,
capture, goal, learning) and built the first full Weekly Review (then a
dialog; promoted to the `/rewind` route by RDS-980).

- Surfaces: `/home`.
- Key files: `components/home/attention-queue.tsx`,
  `components/home/greeting-band.tsx`, `components/home/next-actions-card.tsx`,
  `lib/data/nudges.ts`, `lib/nudge-utils.ts`.
- Simplified: the Weekly Review dialog this ticket built no longer exists,
  see RDS-980.

## 16, RDS-974: Final polish pass (QA-16 audit)

The end-to-end quality audit: walked all nine flows in a headless browser,
swept seed data for content contradictions (persona years-of-experience,
opportunity staleness figures), and unified stray chip/badge styling.

- Surfaces: whole app.
- Key files: `docs/qa-16.md` (the audit record), plus small fixes across
  `lib/data/*.ts`, `components/shared/credibility-chip.tsx`,
  `components/shared/link-chip.tsx`.

## 17, RDS-975: AI-native, embedded-first redesign

Made the Copilot read as source-connected and embedded-first rather than
right-panel-led: the five-beat proposal pattern (signal, why it matters,
evidence, proposed action, controls), `components/ai/`, and the connected
AI signal model.

- Surfaces: `/home` (embedded signals in the attention queue),
  `/opportunities/[id]` Overview (signal section).
- Key files: `components/ai/ai-action-card.tsx`, `evidence-chip.tsx`,
  `evidence-extract.tsx`, `signal-card.tsx`, `review-queue.tsx`,
  `save-back-confirmation.tsx`, `lib/ai-signal-utils.ts`,
  `lib/data/ai-signals.ts`, `lib/data/sources.ts` (first seed),
  `docs/architecture.md` section 7.
- Simplified: `lib/data/sources.ts` here is evidence data only, read by
  signals; it isn't yet a workflow surface, that's RDS-977.

## 18, RDS-976: Layout, composition, and typography pass

A cross-cutting visual pass: IBM Plex Sans and a disciplined display type
scale, Home's hero band, right-aligned date columns, CV Versions grouped
into Base/Tailored, a Track Record coverage rail, Goals' hero treatment.

- Surfaces: `/home`, `/opportunities`, `/cvs`, `/track-record`, `/goals`.
- Key files: `app/globals.css`, `app/layout.tsx`,
  `components/home/attention-queue.tsx`, `components/track-record/coverage-rail.tsx`,
  `app/(app)/cvs/page.tsx`.

## 19, RDS-977: Sources model and workflow

The connected-sources registry and evidence shape, then the `/sources`
workflow surface built on it: a connected tools hub (status, what each tool
unlocks, a 3-step simulated connect flow) and a synced-context inbox with
source-to-object linking.

- Surfaces: `/sources`; evidence chips app-wide.
- Key files: `app/(app)/sources/page.tsx`, `components/sources/*`
  (`tools-hub.tsx`, `tool-card.tsx`, `connect-source-dialog.tsx`,
  `synced-context-inbox.tsx`, `inbox-item-card.tsx`,
  `link-target-picker-dialog.tsx`, `linked-evidence-list.tsx`),
  `lib/data/sources.ts`, `lib/inbox-utils.ts`.
- Simplified: "connecting" a source (Outlook, Granola) flips a status flag
  and reveals pre-seeded evidence; nothing reaches a real inbox or calendar.

## 20, RDS-978: Copy and content-realism pass

Fixed first-person Copilot voice leaking into scripted copy ("I'll parse
it"), generic accept/dismiss toasts that didn't name what changed, and three
Ho Chi Minh City opportunities that read like Silicon Valley postings.

- Surfaces: whole app (copy only, no structural change).
- Key files: `lib/data/copilot-scripts.ts`, `lib/data/opportunities.ts`,
  `lib/data/actions.ts`, `lib/data/insights.ts`.

## 21, RDS-979

No commits in this repository cite RDS-979, and no ticket-map entry in
`docs/architecture.md` names it either. Whatever this ticket covers, it
left no trace in this codebase's history; flagging rather than guessing.

## 22, RDS-980: Rewind

Promoted the Weekly Review from a dialog to a full `/rewind` route: the
week's story (3 theme clusters), evidence-backed achievement candidates to
review (save, edit, dismiss, defer), carry-forwards, and a past-weeks
archive. Added the achievement-depth fields onto `TrackRecordEntry`
(impact signals, source refs, path relevance, highlight) rather than a
forked type.

- Surfaces: `/rewind`; Track Record's Highlights shelf; Home's attention
  queue (accepted carry-forwards pin there).
- Key files: `app/(app)/rewind/page.tsx`, `components/rewind/*`
  (`week-story-band.tsx`, `theme-cluster-card.tsx`, `candidate-card.tsx`,
  `worth-keeping-section.tsx`, `carry-forward-card.tsx`,
  `carry-forward-section.tsx`, `completion-card.tsx`, `archive-list.tsx`),
  `components/track-record/highlights-shelf.tsx`, `lib/data/rewind.ts`,
  `lib/rewind-utils.ts`.
- Simplified: the past-weeks archive is read-only seed data, not a real
  history of prior sessions (state resets on reload by design).

## 23, RDS-982: Path Planner

The strategic path-recommendation and staged-growth-plan workflow: a
recommended path plus up to 2 alternatives, a comparison table, gap and
proof analysis, and a 3-stage growth plan roadmap (Now, Months 1-3, Months
4-6), ending at a concrete plan rather than an insights page.

- Surfaces: `/planner`.
- Key files: `app/(app)/planner/page.tsx`, `components/planner/*`
  (`recommended-path-card.tsx`, `alternatives-section.tsx`,
  `gap-proof-section.tsx`, `growth-plan-section.tsx`, `plan-item-card.tsx`),
  `lib/data/planner.ts`, `lib/planner-utils.ts`.

## 24, RDS-983: Roadmap

Turned the Path Planner's chosen working path into a guided, staged journey:
3 milestones, each with skills-to-move, proof-to-build, and 2-3 resource
recommendations, reading live off Skill/PlanItem/TrackRecordEntry state so
progress never needs a separately tracked number.

- Surfaces: `/roadmap`.
- Key files: `app/(app)/roadmap/page.tsx`, `components/roadmap/*`
  (`orientation-band.tsx`, `do-today-card.tsx`, `milestone-journey.tsx`,
  `milestone-node.tsx`, `resource-card.tsx`, `connections-section.tsx`),
  `lib/data/roadmap.ts`, `lib/roadmap-utils.ts`.

---

**Footnote, RDS-992 (out of this map's RDS-959 to 983 range):** the app shell
and navigation were rebuilt on shadcn's Sidebar primitives after RDS-978,
before RDS-982 (Path Planner). A reviewer tracing the shell's history from
ticket 02 (RDS-960) will land here next: `components/shell/sidebar.tsx`
(exported `AppSidebar`), the four page templates
(`components/shell/dashboard-page.tsx`, `workspace-page.tsx`,
`detail-page.tsx`, `planner-page.tsx`), and `components/ui/sidebar.tsx`
(vendored shadcn primitive). See `docs/lessons.md`'s "RDS-992 app shell,
navigation, and template redesign" entry for the UX-law review from that
pass.

**RDS-981 (this ticket):** the hygiene pass that produced this file. See
`docs/lessons.md` for what it found, and the git log for the cleanup and
documentation commits.
