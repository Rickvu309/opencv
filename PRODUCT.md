# Product

This PRD describes the product the app-shell prototype validated (`prototype/app-shell`, frozen 2026-08-24). The prototype is the UX reference; this file records what it decided and what it left open. Vocabulary: `CONTEXT.md`.

## Users

Vietnamese early-career users: university students (roughly year 3–4) and new graduates with under ~5 years of experience. They are unsure of direction, easily swayed by trends, and often cannot afford or access a human mentor. They use OpenPath in short, anxious sessions — between classes, late at night before a deadline — asking questions they'd hesitate to ask a professor.

**Job to be done:** understand myself, find a direction that fits, and know the next concrete step.

Secondary (later): companies hiring early-career talent who want better-fit candidates at lower cost.

## Purpose

OpenPath is a personalised AI career Coach inside a working product. The User lives in one shell: Home is the Coach; Paper, Apply, and Pitch are the craft surfaces where career evidence gets made, used, and shown. The Coach helps build all three by acting through Commands, not only advising.

Success: a User who decides from evidence about themselves and the market (not trend-chasing), and who comes back weekly.

## The product (validated by prototype)

### Shell
Grok-style layout (ADR-0004): collapsible left sidebar — Home, Search, Paper, Apply, Pitch, History (recent Threads), profile → Settings — and a main pane the active surface fills. Search is a ⌘K modal with quick actions and Thread lookup.

### Home — the Coach
Idle: time-of-day greeting, suggestion chips, multi-line composer, connect-apps row. Sending switches Home into a chat Thread; History resumes old Threads; new chat returns to idle.

### Paper — evidence and documents
Drive-style workspace of CVs, Letters, and Proofs with status (draft/ready/published) and links to Apply. CV editor: five templates (classic internship, product & design, project-led, campus, with-photo), A4 pagination, section editing. Proof editor: chain or timeline of context → action → outcome steps with photos. An AI-chat side panel assists editing.

### Apply — pursuit tracking
Kanban of Opportunity cards across Stages (Inbox, Prep, Sent, Live, Closed) with drag-and-drop, a calendar of Tracks (interviews, deadlines, follow-ups), per-card Fit score and notes, and a job-detail view.

### Pitch — the shareable portfolio
Read.cv-style page: about, achievements, experience, work, GitHub heatmap, Instagram-style story highlights, bento moments, gallery, contact. Edit mode hides/shows blocks; publish produces a copyable link.

### Settings
Tabs: General, Connected apps (catalog stub — Gmail, Outlook, Google Calendar), Account (placeholder until auth).

### Notifications
Bell popover inbox on Home (Apply and Paper events). Prototype-validated; ships after the shell.

## Productionization order

The prototype is throwaway code; production rebuilds it spec by spec. Spec 3 = shell + stub surfaces; Spec 4 = auth + durable Paper / Apply / Threads. Pitch persistence and the real Coach follow (see `docs/specs/spec-3-app-shell.md`, Route to real product).

## Out of scope

- Search / job-board discovery (Users bring Opportunities in themselves).
- Publishing or scheduling social posts. Pitch publishes a portfolio link only.
- Real OAuth for Connected apps.
- Company/recruiter product.
- i18n / Vietnamese copy (English first).

## Open questions (created by the prototype, not settled)

1. **Naked Fit score.** Cards show a bare 0–100 number. Principle 1 says claims show their basis; anti-references warn against career-quiz astrology. Production Fit must either show its evidence or not ship as a number.
2. **Live GitHub APIs.** Pitch calls `api.github.com` and a third-party contributions API (`jogruber.de`) client-side. Dependency, rate limits, and privacy are undecided.
3. **Paper storage format.** Settled in ADR-0006: `paper_docs` stores `content_kind` + `content jsonb` + `content_version`. The prototype's `cv:v1:` / `proof:v1:` prefixed strings are retired.
4. **Seed persona.** Settled for real accounts (Spec 4): signup writes a neutral starter workspace (sample CV, a few Apply cards, one Thread) in the product voice. "Eric Nguyen" is demo data only and must not appear. Pitch still uses a placeholder author until Pitch persistence lands.
5. **Pitch post drafts.** The pre-prototype "social post drafts" idea is out of the definition; whether it returns as a later Pitch phase is unresolved.

## Personality

Grounded, warm, honest — like a good older mentor: encouraging but not flattering; willing to push back with evidence. No hype, no gamified badges, no corporate-HR voice. English for now: second person, contractions OK, no exclamation marks.

## Principles

1. **Evidence over encouragement.** Claims show their basis (Profile, market, a real gap).
2. **One next step, always visible.** A lost User never leaves without knowing what to do next.
3. **Calm under uncertainty.** Restraint and clarity are functional for anxious Users.
4. **Honest about distance.** Show the real gap to a goal, including when it is large.
5. **Coach can act, with trust.** The Coach operates via the same Commands as the User where allowed; never claim an action that did not succeed.

## Anti-references

- Trend-chasing edtech / career-quiz astrology (confetti, badges, flattery).
- Enterprise HR dashboards that turn a person into KPI widgets.
- Generic SaaS chrome and "AI chatbot" bolted on as support afterthought.
