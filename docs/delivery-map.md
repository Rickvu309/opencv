# Delivery map

An index for the next reviewer: what each ticket from RDS-959 through
RDS-994 actually shipped, where it lives, and what was intentionally
simplified or simulated. Built from `git log` and verified against the
current code, first as part of RDS-981's hygiene pass (sections 01 to 24),
then extended by RDS-990's closing quality gate (sections 25 to 34).
Sections are numbered sequentially, one per RDS ticket that actually shipped
commits, in the order it shipped; see the note on RDS-979, and the
footnotes on RDS-981 and RDS-992, for the two tickets that don't fit that
pattern (each restructured how this file itself is organized rather than
shipping a product surface).

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
  see RDS-980. `attention-queue.tsx` and `next-actions-card.tsx` no longer
  exist either, replaced by `components/home/decision-queue.tsx` and
  `today-checklist.tsx`, see the RDS-993 entry below.

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
  `components/home/attention-queue.tsx` (since replaced, see the RDS-993
  entry below), `components/track-record/coverage-rail.tsx`,
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

## 25, RDS-984: Product-wide UI design maturity pass

Wrote `docs/design.md` as the visual design authority, then brought the
codebase into line with it: a token pass in `globals.css`, one shared chip
tone table, `Card` primitive standardization, a product-wide consistency
audit, and a UX-law gate.

- Surfaces: whole app (visual pass, no structural change).
- Key files: `docs/design.md` (new), `app/globals.css`,
  `components/shared/chip-tones.ts` (new),
  `components/shared/{credibility,fit,priority,status}-chip.tsx`,
  `components/ui/card.tsx`, `components/goals/goal-status-chip.tsx`,
  `components/sources/source-status-chip.tsx`,
  `components/skills/skill-level-meter.tsx`,
  `components/shell/desktop-guard.tsx`.
- Simplified: nothing simulated changed, this pass touched pixels and
  tokens, not behavior.

## 26, RDS-985: Opportunity comparison and decision workspace

Gave `/opportunities` a Compare selection mode (2 to 4 candidates) launching
`/opportunities/compare`: pinned candidate header cards, a 6-dimension
comparison grid, a tradeoffs strip, up to 3 Copilot verdict cards, and a
"Make this my focus" decision that ends the scan-and-prioritize flow with an
actual decision rather than more comparison.

- Surfaces: `/opportunities` (Compare mode), `/opportunities/compare`.
- Key files: `app/(app)/opportunities/compare/page.tsx` (new),
  `components/opportunities/compare/*` (`comparison-header-cards.tsx`,
  `comparison-dimension-grid.tsx`, `comparison-tradeoffs.tsx`,
  `comparison-verdicts.tsx`, `comparison-decision-actions.tsx`,
  `comparison-judgment-chip.tsx`, `comparison-recover-state.tsx`),
  `components/opportunities/{comparison-bar,comparison-checkbox}.tsx` (new),
  `components/ui/popover.tsx` (new), `lib/comparison-utils.ts` (new),
  `lib/data/comparison.ts` (new).
- Simplified: the verdict cards are computed deterministically from seed
  data, not a real ranking model; "Make this my focus" raises priority and
  pins the next action, it doesn't apply anything the user didn't approve.

## 27, RDS-986: Pipeline strategy and focus coach

Added `/strategy`, a weekly coaching surface reading live off Opportunity,
NextAction, ActivityMoment, and Goal state: a pipeline health verdict plus 3
indicators, up to 3 seeded strategic observations, a weekly focus plan of up
to 4 moves (focus, deprioritize, invest, pursue-more) with real save-backs,
and a 3-segment drill-down into `/opportunities` and the RDS-985 comparison
flow.

- Surfaces: `/strategy`.
- Key files: `app/(app)/strategy/page.tsx` (new), `components/strategy/*`
  (`pipeline-health-band.tsx`, `health-indicator-card.tsx`,
  `key-observations.tsx`, `observation-card.tsx`, `weekly-focus-plan.tsx`,
  `focus-move-card.tsx`, `segment-strip.tsx`,
  `strategy-plan-completion-card.tsx`), `lib/strategy-utils.ts` (new),
  `lib/data/strategy.ts` (new), `lib/store/reducers/strategy.ts` (new).
- Simplified: the weekly plan is computed once at mount (a lazy
  `useState` initializer), not re-ranked live, so approving one move never
  reshuffles the others mid-decision; a fresh visit computes a fresh plan.

## 28, RDS-987: Proof Builder

Added `/proof`, a proof-construction and verification workflow: a context
picker (a CV version, the profile, an opportunity, or the target path)
frames an evidence layer (every confirmed Track Record entry ranked by
proof strength), claim verification for CV and profile contexts, and 7
seeded before-after transformation blocks with Accept, Edit inline, and
Skip.

- Surfaces: `/proof`.
- Key files: `app/(app)/proof/page.tsx` (new), `components/proof/*`
  (`proof-context-picker.tsx`, `proof-evidence-layer.tsx`,
  `proof-claim-verification.tsx`, `proof-transformation-card.tsx`,
  `proof-session-summary.tsx`, `claim-state-chip.tsx`,
  `proof-strength-chip.tsx`, `track-record-evidence-chip.tsx`),
  `lib/proof-utils.ts` (new), `lib/data/proof.ts` (new),
  `lib/store/reducers/proof.ts` (new).
- Simplified: Accept always writes to one of five real targets (a CV
  section, the profile summary, a strength's evidence note, an
  opportunity's positioning notes, or a growth-plan `PlanItem`) and stores
  its own undo payload on the `ProofTransformation` itself, so Undo survives
  a remount without the component holding state.

## 29, RDS-988: Recruiter mode (a second persona inside one product)

Added a second, distinct persona mode at `/recruiter/*`: its own route
group and layout, its own sidebar, and its own store domain
(`recruiterRoles`/`recruiterCandidates`), sharing the design system and
shell primitives but never a reskin of the candidate-side screens. Object
model: `RecruiterRole` (2 seeded) and `RecruiterCandidate` (12 seeded)
across 6 pipeline stages.

- Surfaces: `/recruiter`, `/recruiter/roles`, `/recruiter/candidates`,
  `/recruiter/candidates/[id]`.
- Key files: `app/(recruiter)/*` (layout plus 4 pages, new),
  `components/recruiter/*` (17 new files at this point, including
  `recruiter-pipeline-board.tsx`, `recruiter-pipeline-list.tsx`,
  `recruiter-candidate-card.tsx`, `candidate-identity-band.tsx`,
  `candidate-ai-summary-block.tsx`, `candidate-highlights.tsx`,
  `candidate-stage-history.tsx`, `recruiter-advance-stage-dialog.tsx`),
  `components/shell/recruiter-sidebar.tsx` (new), `lib/data/recruiter/*`
  (`roles.ts`, `candidates.ts`, `copilot-scripts.ts`, `persona.ts`, all
  new), `lib/recruiter-utils.ts` (new), `lib/store/reducers/recruiter.ts`
  (new), `CONTEXT.md` (Recruiter mode section added).
- Simplified: every recruiter-mode type carries an explicit `Recruiter`
  prefix (`RecruiterCandidate`, `RecruiterRole`, `RecruiterStage`) so its
  domain vocabulary can reuse plain English words ("Candidate", "Role")
  that already mean something different on the candidate side, without a
  TypeScript collision. The Review/Outreach/Submission sections this ticket
  scaffolds are deepened by RDS-989 below.

## 30, RDS-993: Home information architecture (a stronger command center)

Decided what Home is for (docs/architecture.md section 10) and rebuilt it
top to bottom on that rule: the command band, a merged "Needs a decision"
list (`AiSignal` and `Nudge` ranked together, capped at 3), "Today" (accepted
next actions only), and a read-only "What changed" digest. The old
`attention-queue.tsx` and `next-actions-card.tsx` (RDS-973/976) are gone,
replaced by this ticket's own components.

- Surfaces: `/home`.
- Key files: `app/(app)/home/page.tsx`, `components/home/*`
  (`decision-queue.tsx`, `decision-detail-sheet.tsx`, `today-checklist.tsx`,
  `what-changed-digest.tsx`, `entry-tiles-row.tsx`, `stat-tiles.tsx`, all
  new or rebuilt; `greeting-band.tsx` kept), `lib/home-utils.ts` (new).
  Deleted: `components/home/attention-queue.tsx`,
  `components/home/next-actions-card.tsx`, `components/home/rewind-banner.tsx`.
- Simplified: stat tiles show live counts only, never a delta, since the
  prototype has no persisted prior snapshot to compare against and a
  fabricated delta would be exactly the placeholder content the realism
  rules forbid.

## 31, RDS-989: Recruiter candidate review, outreach, and submission workflow

Deepened RDS-988's Review/Outreach/Submission scaffolds into the
recruiter's decision-and-action surface: a `RecruiterReview` (Strengths,
Concerns, Unknowns), a `RecruiterDecision` block (advance, hold, request
more info, do not advance, each logging to stage history with its own
save-back and Undo), scripted `RecruiterOutreachDraft`s for 4 common
moments, and a `RecruiterSubmission` packet workflow gated on a live
readiness checklist.

- Surfaces: `/recruiter/candidates/[id]` (Review, Decision, Outreach,
  Submission sections).
- Key files: `components/recruiter/{candidate-review-section,
  candidate-decision-block,recruiter-decision-dialog,outreach-draft-card,
  candidate-outreach-section,candidate-submission-section,
  candidate-status-indicators,candidate-notes}.tsx`,
  `lib/recruiter-outreach-utils.ts` (new),
  `lib/recruiter-submission-utils.ts` (new), `lib/recruiter-utils.ts`,
  `lib/data/recruiter/{candidates,copilot-scripts}.ts`,
  `lib/store/reducers/recruiter.ts`.
- Simplified: 6 candidates (rc-1, rc-3, rc-4, rc-5, rc-6, rc-8) carry full
  seeded review/decision/outreach content; the rest carry a shorter version
  plus computed fallbacks (`buildFallbackOutreachDrafts`,
  `buildFallbackHiringManagerSummary`), so every candidate has something
  real to show without every candidate needing hand-authored copy.

## 32, RDS-994: Opportunities Active/Watchlist workspace lens

Replaced the flat 5-status board with a page-level Active/Watchlist
segmented control, two lenses over the same `Opportunity[]`/`NextAction[]`
data: Active (Applied/Interview/Offer always, Saved once it has an accepted
next action), Watchlist (Dream-flagged or freshly-saved items not yet
claimed by Active). Moving between them is a real state change with a named
confirmation dialog, not a filter toggle.

- Surfaces: `/opportunities`.
- Key files: `app/(app)/opportunities/page.tsx`, `components/opportunities/
  {opportunities-mode-toggle,opportunities-summary-band,watchlist-view,
  move-to-active-dialog,move-to-watchlist-dialog,ai-signal-glyph}.tsx` (new),
  `components/opportunities/{opportunity-board-view,opportunity-list-view,
  opportunity-quick-actions-menu}.tsx`, `lib/opportunity-utils.ts`,
  `lib/store/reducers/opportunities.ts`.
- Simplified: the Active board's 4 pipeline-stage columns are fixed-width
  in a horizontally scrolling row rather than an equal-fraction grid (the
  same fix RDS-988's 6-column recruiter board needed), since a positional
  pipeline can't reflow per viewport the way Watchlist's plain card grid
  can.

## 33, RDS-991: Public landing page

Added `/`, the public marketing landing: one guided narrative (hero,
problem and thesis, how it works, four signature-workflow showcases
rendering real live product components in a framed, `inert`, non-interactive
shell, the AI difference, recruiter mode, closing CTA). Renders outside
`DesktopGuard` on purpose, so it holds down to 390px while every app route
keeps the desktop-only guard, moved out of the root layout and into each
guarded area's own layout instead.

- Surfaces: `/`.
- Key files: `app/page.tsx`, `app/layout.tsx`, `app/(app)/layout.tsx`,
  `app/(recruiter)/layout.tsx`, `app/onboarding/layout.tsx` (new),
  `components/marketing/*` (18 files: `hero-section.tsx`,
  `problem-thesis-section.tsx`, `how-it-works-section.tsx`,
  `signature-workflows-section.tsx`, `showcases/*` (4 files),
  `ai-difference-section.tsx`, `recruiter-section.tsx`,
  `closing-section.tsx`, `browser-frame.tsx`, `lazy-mount.tsx`,
  `scroll-reveal.tsx`, `showcase-block.tsx`, `showcase-skeleton.tsx`,
  `sticky-cta.tsx`, `open-openpath-button.tsx`, `marketing-footer.tsx`,
  `landing-page.tsx`, `use-parallax.ts`).
- Simplified: the showcases render real product components with real seed
  data, not screenshots, but the whole composition is `inert` and
  non-interactive; "Open OpenPath" reads `state.onboarded` fresh on every
  mount, so a hard reload of `/` always re-offers onboarding even in a
  browser tab that just finished it, the same no-persistence rule as the
  rest of the prototype.

## 34, RDS-990: End-to-end review, testing, cleanup, and repository documentation (this ticket)

The closing quality gate over tickets 25 through 33 above (RDS-984 through
RDS-994) plus a final look at the whole product: a headless-browser
walkthrough of every major journey in both modes, state verification (save-
back naming, Undo, empty states, refresh mid-flow, long input text, 1440
and 1280-with-panel widths), the fix these found, a repository cleanup pass
(dead exports, an orphan file, stale doc references), this delivery-map
extension, and a real `README.md`. See `docs/qa-final.md` for the full audit
record and `docs/lessons.md` for this pass's own entry.

- Surfaces: whole app (audit and fixes), plus documentation only
  (`README.md`, this file, `docs/qa-final.md`).
- Key files: `components/shell/copilot-panel.tsx` (the one real defect this
  pass found and fixed, see `docs/qa-final.md`), `lib/recruiter-utils.ts`
  (dead export removed), `README.md` (new), `docs/qa-final.md` (new),
  `docs/delivery-map.md`, `docs/architecture.md`, `docs/design.md`,
  `docs/lessons.md`. Removed: `components/ui/input-group.tsx` (orphan,
  predates this range).
- Simplified: nothing simulated changed; this ticket found the product
  already close to shipped condition after 9 UX-law-reviewed tickets, one
  real layout defect and a handful of stale doc references, not a rebuild.

---

Sections 25 to 34 above cover the 9 RDS tickets with commits in this range
(984 through 989, 991, 993, 994, in the order they actually shipped, which
is not strict numeric order: RDS-993 shipped before RDS-989, and RDS-991
shipped last) plus RDS-990 itself as the closing section, the same role
RDS-974 played for the first range's own final-polish ticket. RDS-992
remains covered by its own footnote below, out of chronological order for
the same reason noted there, not duplicated into this range's numbering.

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
