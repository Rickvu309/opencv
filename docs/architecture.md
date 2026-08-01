# OpenPath prototype architecture

This is the structural foundation for the OpenPath high-fidelity prototype (Linear ticket RDS-959). Every downstream ticket builds against this document. If a downstream ticket conflicts with this document, the ticket wins, then this document gets updated.

## 1. Product intent

OpenPath is an AI-native career workspace. The prototype must feel like a serious desktop product where AI participates in the work, not a tracker and not a chat app.

The product helps the user:

1. organize opportunities
2. understand which ones deserve attention
3. decide what to do next
4. adapt profile and CV materials per opportunity
5. build long-term career memory: track record, goals, skills

## 2. Stack and constraints

- Next.js 16 (App Router), TypeScript, Tailwind 4, shadcn/ui, npm.
- Desktop web only. Below 1024px, show a polite "OpenPath is a desktop product" screen.
- No backend, no persistence, no real AI calls. All data is typed TS mock modules. All AI output is scripted.
- State lives in one client store (React context + reducer). State resets on reload by design.
- All components client-render from the store; pages are thin route wrappers.

## 3. App structure and navigation

Left sidebar (16rem expanded, collapsible to a 3rem icon rail), main content area, and a Copilot panel that docks on the right (360px, toggleable, context-aware). Sidebar and content share one integrated frame: no floating gap between them.

The sidebar is built on the shadcn/ui Sidebar primitives (`components/ui/sidebar.tsx`, `SidebarProvider` + `SidebarInset`), adapted in `components/shell/sidebar.tsx` (exported as `AppSidebar`) rather than hand-rolled. Collapse state is `sidebarOpen` in the app store (`setSidebarOpen`), consistent with the rest of the prototype's session-only state, not a cookie. Toggle it from the trigger in every page header (`PageHeader`, next to the title) or the Cmd/Ctrl+B shortcut; Cmd/Ctrl+K still opens the Copilot panel. Collapsed to icons, every nav row shows its label as a tooltip on hover.

Sidebar structure:

```
OpenPath (logo)
  Home                    /home
  Opportunities           /opportunities
  Sources                 /sources
  Rewind                  /rewind
CAREER MEMORY
  Profile                 /profile
  CV Versions             /cvs
  Track Record            /track-record
DIRECTION
  Path Planner            /planner
  Roadmap                 /roadmap
  Goals                   /goals
  Skills & Learning       /skills
(bottom)
  Rewind                  shortcut into /rewind, mirrors the primary nav item
  Demo Tour               opens tour dialog
  Connected sources       shortcut into /sources, compact status only
  Persona chip (Mai Tran)
```

Drill-downs:

- /opportunities -> /opportunities/[id] (tabs: Overview, AI Analysis, Actions, Materials, Activity)
- /cvs -> /cvs/[id]
- /sources: connected tools hub plus the synced-context inbox, see section 7
- /rewind: the connected weekly review as a full surface, see flow 9

### Page template system

Four layout components under `components/shell/` codify one frame rule set (content max-width per page type, one padding scale, one header anatomy: sidebar trigger, title, one-line purpose, primary action, Copilot toggle) so pages stop each inventing their own container. Every route in the `(app)` group renders through one of these; none render `PageHeader` and their own wrapper `div` directly.

| Template | Max width | Shape | Routes |
|---|---|---|---|
| `DashboardPage` | max-w-6xl | Single column, no rail | /home |
| `WorkspacePage` | max-w-[1600px] | Object listing, optional `band` and `rail` slots | /opportunities, /sources, /cvs, /track-record |
| `DetailPage` | max-w-5xl | Primary column plus an optional quiet support rail (standardized to w-72, e.g. `CvMetaRail`, `CoverageRail`, Profile's three support cards) | /opportunities/[id], /cvs/[id], /profile |
| `PlannerPage` | max-w-6xl | Single column, optional full-bleed `band` | /planner, /roadmap, /goals, /skills, /rewind |

`band` is full-bleed content directly under the header (edge to edge, no padding), for a top-of-page summary like `ProfileIdentityBand` or `DirectionBand`. It differs from a page's own inline summary band (`OpportunitySummaryBand`), which stays inside the padded content column since it was designed as a chip row, not a bleed panel.
- /onboarding: full-screen flow shown on first run (store flag `onboarded`), skippable, ends at /home

Header per page: page title, primary action button, Copilot toggle button.

## 4. User-flow map

Nine flows. Each must have one complete clickable path.

1. First-run setup: /onboarding -> welcome -> role and location -> target direction -> goals seed -> import profile (mock) -> land on /home with context banner.
2. Add an opportunity: /opportunities "Add" -> dialog with two tabs (Paste link or description, Manual) -> paste path shows AI parsing state -> structured preview -> user edits and confirms -> new card appears in Saved.
3. Scan and prioritize: /opportunities board or list -> filter and sort by fit, priority, status -> quick actions on cards (change status, flag Dream, open).
4. Understand one opportunity: /opportunities/[id] Overview -> AI Analysis tab: summary, credibility check, fit judgment (strengths, concerns, unknowns, confidence) -> user asks Copilot follow-ups (scripted).
5. Decide next step: opportunity Actions tab or /home: recommended next actions with rationale -> accept, edit, or dismiss -> accepted action shows on card and /home.
6. Tailor materials: opportunity Materials tab -> link a CV version -> "Tailor for this role" -> AI suggestions per section -> accept or dismiss each -> creates a tailored CV version in /cvs.
7. Capture track record: /track-record -> manual add, or review AI-drafted candidates (from recent activity) -> confirm or dismiss -> entry joins timeline and links to skills.
8. Review direction: /goals gap analysis against target direction -> /skills gap map -> learning recommendations linked to goals -> accept a learning item to plan.
9. Proactive loop: /home nudges (stale opportunity, capture prompt, high-potential flag) plus Rewind (RDS-980), the connected weekly review as a full route: the week's story, evidence-backed achievement candidates to review (save, edit, dismiss, defer), and carry-forwards into next week -> each proposal accepted, edited, or dismissed, nothing applies itself.

AI helps inside every flow. It never auto-applies anything (see section 9).

## 5. Object model (UI terms)

| Object | Key visible fields | Home surface | User actions | Links |
|---|---|---|---|---|
| Opportunity | role, company, status, fit level, priority, next action, Dream flag, source, salary range, location | /opportunities | change status, flag, open, archive | AiInsight, NextAction, CvVersion, Goal |
| Profile | headline, summary, strengths, experience entries, preferences, target direction | /profile | edit sections, see "what AI uses" | everything |
| CvVersion | name, base or tailored, linked opportunity, sections, last edit | /cvs | create, duplicate, tailor, link | Opportunity |
| TrackRecordEntry | title, story, impact, date, evidence tag, skills, optional achievement depth (impact signals, source refs, path relevance, highlight flag) | /track-record | add, confirm draft, edit, dismiss | Skill, Profile, SourceEvidence |
| Goal | title, why, target date, progress note, status | /goals | add, edit, mark progress | Opportunity, LearningItem |
| Skill | name, level, target level, gap flag | /skills | adjust level, mark focus | TrackRecordEntry, LearningItem |
| LearningItem | title, type (course, project, habit), effort, linked skill or goal | /skills | accept to plan, dismiss | Skill, Goal |
| AiInsight | kind (summary, credibility, fit, tailoring, gap), body blocks, confidence | inside host object | expand, ask follow-up | host object |
| NextAction | verb phrase, rationale, effort, due hint, state (suggested, accepted, done, dismissed) | opportunity + /home | accept, edit, dismiss, mark done | Opportunity |
| Nudge | trigger, message, why, 1 to 2 deep-link actions | /home | act, snooze, dismiss | any object |

Opportunity statuses: Saved, Applied, Interview, Offer, Closed. Dream is a flag, not a status. Fit levels: Strong, Medium, Weak, Unknown. Priority: High, Medium, Low.

## 6. Mock data blueprint

Persona: Mai Tran, senior product designer, 9 years, based in Ho Chi Minh City, moving toward AI product design and product leadership, open to remote roles. All seeded content must read as this one coherent person.

Seed set (lives in `lib/data/`):

- 10 opportunities: 4 Saved (one Dream, one low-credibility posting, one freshly saved with no next step queued yet), 2 Applied, 2 Interview, 1 Offer, 1 Closed. Mixed fit levels and priorities. The 9 original opportunities all have full AI output; the 10th (added for ticket 15's missing-next-step nudge) is intentionally still raw, Copilot hasn't read it yet.
- Profile: headline, summary, 4 strengths, 4 experience entries, preferences, target direction.
- 3 CV versions: "Base CV", "Product-lead CV", one tailored version linked to an Interview opportunity.
- 10 track record entries plus 2 unconfirmed AI-drafted candidates.
- 4 goals, one with a gap analysis.
- 12 skills, 4 flagged as gaps; 6 learning items.
- 6 next actions in mixed states, 6 nudges covering all four attention-queue families (opportunity, capture, goal, learning), 1 weekly review script.
- Copilot scripts: per-surface suggested prompts and 2 to 3 scripted exchanges per major surface.

File layout: `lib/types.ts` (all types), `lib/data/persona.ts`, `opportunities.ts`, `cvs.ts`, `track-record.ts`, `goals.ts`, `skills.ts`, `insights.ts`, `actions.ts`, `nudges.ts`, `copilot-scripts.ts`. Store in `lib/store/` (state, actions, reducer domains under `reducers/`, and the provider).

`lib/store/` (RDS-981 hygiene pass, split from one 1993-line `lib/store.tsx`): `state.ts` (StoreState, initial state), `actions.ts` (the reducer's Action union), `reducer.ts` (routes each action to its domain), `reducers/*.ts` (one file per domain: onboarding, opportunities, ai-signals-and-sources, cvs, direction, track-record-and-rewind, profile, shell), `provider.tsx` (StoreProvider, useStore, useCopilotSurface, the action-creator callbacks), `helpers.ts` (today, makeId), `index.tsx` (re-exports the same public API so `@/lib/store` imports are unchanged).

## 7. Simulated AI behavior model

AI-native, source-connected, embedded first (RDS-975). The Copilot is one system, but it no longer leads with the right panel. It appears in four forms:

1. embedded AI proposals, the default pattern: `components/ai/` (AiActionCard, EvidenceChip, EvidenceExtract, ReviewQueue, SaveBackConfirmation), used wherever AI proposes concrete work
2. inline insight blocks inside pages (fit judgment, tailoring suggestions, drafted candidates)
3. proactive surfaces (the Home attention queue mixes AiActionCards with legacy nudges, Rewind at /rewind)
4. the right panel, now secondary deep help: Cmd+K and the header toggle still open it, but primary-level "Ask Copilot" CTAs are removed wherever an embedded surface already covers the job

### The five-beat pattern

Every embedded AI proposal is one compact block, five beats:

1. **Signal**: what the system noticed, one line with a kind icon
2. **Why it matters**: one line
3. **Evidence**: a source chip ("Email, Sarah Nguyen, 2h ago") plus an expandable extract, never hidden grounding
4. **Proposed action**: the concrete change, stated as what will happen if you accept
5. **Controls**: Approve, Edit (inline adjust before approving), Dismiss. Approving shows a save-back confirmation that names exactly what changed, with an Undo, then settles into a quiet done state

Approving a proposal changes real store state and logs an Activity moment carrying the same evidence, see `lib/store/reducers/ai-signals-and-sources.ts`'s `APPROVE_AI_SIGNAL` case and `lib/ai-signal-utils.ts`.

### Connected sources (simulated)

`lib/data/sources.ts` seeds a connected-sources registry (Gmail connected, Outlook and Granola not connected, extensible to further source types) and a shared evidence shape covering both email extracts and Granola meeting notes, each with a sender or attendee line, a subject or title, a timestamp, and the opportunity, Track Record candidate, or goal it maps to. A quiet "Connected sources" affordance in the sidebar shows how many sources are connected and links straight to /sources. Every AI proposal that cites a source shows its evidence chip and extract; the panel's context header shows the same connected source line on any surface backed by evidence.

`/sources` (RDS-977) turns this registry into a workflow surface, not a settings page: a connected tools hub (status chip, what each tool gives OpenPath, what it unlocks, a 3-step simulated connect flow) above a synced-context inbox listing every evidence item from a connected source, newest first, filterable by source and by review state. Each row proposes a link target (an opportunity, a Track Record candidate, or a goal), with a confidence hedge when the read is uncertain. Linking is store-wired: to an opportunity it logs an Activity moment and shows in that opportunity's Overview; as Track Record material it drafts a fresh candidate in the review inbox; to a goal it attaches an evidence chip on the goal card. `lib/inbox-utils.ts` holds the read-only merge of seed evidence with live connection and link state; `lib/store/reducers/ai-signals-and-sources.ts`'s `CONNECT_SOURCE`, `LINK_INBOX_ITEM`, `UNDO_LINK_INBOX_ITEM`, and `DISMISS_INBOX_ITEM` cases hold the writes.

Scripted behaviors:

- interpret messy intake input into structured opportunity fields
- summarize a role in plain language
- validate credibility (one seeded posting fails checks, with reasons)
- judge fit: labeled blocks for strengths, concerns, unknowns, plus a confidence chip
- recommend next actions with a one-line rationale each
- tailor CV guidance per section
- propose next-action, status, priority, and drafted-reply changes grounded in connected-source evidence (the five-beat pattern)
- draft track record candidates from recent activity and from grouped connected-source evidence
- flag skill gaps against target direction and suggest learning items
- nudge on stale or high-potential opportunities, run the weekly review

Trust boundary, absolute rule: the AI drafts and suggests, the user accepts, edits, or dismisses. Nothing AI-generated applies itself. Every AI block shows a small "Copilot" label so scripted output is visually distinct.

## 8. Realism rules

1. No placeholder text anywhere. Every object has believable content written for the Mai Tran persona.
2. Every flow in section 4 has at least one complete clickable path.
3. AI output always references the specific object it sits on, never generic filler.
4. Empty states are designed: one line of guidance plus the action to fill them.
5. Visual patterns stay consistent: same card anatomy, same chip system for status, fit, priority, confidence across all surfaces.
6. Interactions give feedback: toasts on accept and dismiss, brief simulated "thinking" states (600 to 1200ms) before AI output appears.

## 9. Ticket map

- 02 shell and patterns: sections 3, 7 (panel shell), chips, card anatomy
- 03 onboarding: flow 1
- 04 intake: flow 2
- 05 workspace: flow 3
- 06 detail: flow 4 surface
- 07 AI understanding: flow 4 AI content
- 08 next actions: flow 5
- 09 profile: Profile object
- 10 CVs: flow 6
- 11 track record: flow 7
- 12 goals: flow 8 (goals half)
- 13 skills and learning: flow 8 (skills half)
- 14 copilot layer: section 7 form 1 everywhere
- 15 proactive: flow 9
- 16 polish: section 8 audit end to end
- 17 sources model: section 7's connected-sources registry and evidence shape
- RDS-977 sources workflow: section 3 nav (/sources), section 7's tools hub and synced-context inbox
- RDS-982 path planner: section 3 nav (/planner, PlannerPage template), the strategic path-recommendation and staged-growth-plan workflow, ending at a chosen working path and a concrete plan rather than an insights page
- RDS-980 Rewind: section 3 nav (/rewind, PlannerPage template), flow 9's connected weekly review promoted from a dialog to a full surface, and the TrackRecordEntry achievement depth (impactSignals, sourceRefs, pathRelevance, highlight) it writes into section 5's object model
- RDS-983 roadmap: section 3 nav (/roadmap, PlannerPage template), flow 8 deepened: the Path Planner's chosen working path turned into a guided, staged journey (RoadmapMilestone, RoadmapResource, `lib/data/roadmap.ts`, `lib/roadmap-utils.ts`) rather than a flat content list, reading live off Skill, PlanItem, and TrackRecordEntry state so completing a plan item or confirming a Rewind achievement advances milestone progress without a separately tracked number
- RDS-985 opportunity comparison: /opportunities gets a Compare selection mode (2 to 4 candidates, a floating count bar, a quick "Add to comparison" action) launching /opportunities/compare on the WorkspacePage template: pinned candidate header cards, a 6-dimension comparison grid (`OpportunityComparisonProfile`, `lib/data/comparison.ts`, `lib/comparison-utils.ts`), a tradeoffs strip and up to 3 Copilot verdict cards computed deterministically from that same seed data, and a "Make this my focus" decision (raises priority, pins the next action into Home, logs Activity, save-back with Undo) ending the flow 3 workspace scan with an actual decision rather than more comparison
