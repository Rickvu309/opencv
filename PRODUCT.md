# Product

This document records product intent and open questions. `CONTEXT.md` defines the vocabulary. Source and tests describe the current implementation.

## Users

Vietnamese early-career users: university students (roughly year 3–4) and new graduates with under ~5 years of experience. They are unsure of direction, easily swayed by trends, and often cannot afford or access a human mentor. They use OpenCV in short, anxious sessions — between classes, late at night before a deadline — asking questions they'd hesitate to ask a professor.

**Job to be done:** understand myself, find a direction that fits, and know the next concrete step.

Secondary (later): companies hiring early-career talent who want better-fit candidates at lower cost.

## Purpose

OpenCV is a personalised AI career Coach inside a working product. The User lives in one shell: Home is the Coach; Paper, Apply, and Pitch are the craft surfaces where career evidence gets made, used, and shown. The Coach helps build all three by acting through Commands, not only advising.

Success: a User who decides from evidence about themselves and the market (not trend-chasing), and who comes back weekly.

## Product surfaces

### Shell

Layout: collapsible left sidebar — Home, Search, Paper, Apply, Pitch, History (recent Threads), profile → Settings — and a main pane the active surface fills. Search is a ⌘K modal with quick actions and Thread lookup.

### Home — the Coach

Idle: time-of-day greeting, suggestion chips, multi-line composer, connect-apps row. Sending switches Home into a chat Thread; History resumes old Threads; new chat returns to idle.

### Paper — evidence and documents

Drive-style workspace of CVs, Letters, and Proofs with status (draft/ready/published) and links to Apply. CV editor: five templates (classic internship, product & design, project-led, campus, with-photo), A4 pagination, section editing. Proof editor: chain or timeline of context → action → outcome steps with photos. The documents list is hideable. Coach is a bottom-right float on the open doc (same Thread as Home); edit asks run `paper.updateContent` instead of "paste this yourself".

### Apply — pursuit tracking

Kanban of Opportunity cards across Stages (Inbox, Prep, Sent, Live, Closed) with drag-and-drop, a calendar of Tracks (interviews, deadlines, follow-ups), per-card Fit score and notes, and a job-detail view.

### Pitch — the shareable portfolio

Read.cv-style page: about, achievements, experience, work, GitHub heatmap, Instagram-style story highlights, bento moments, gallery, contact. Edit mode hides/shows blocks; publish produces a copyable link.

### Settings

Tabs: General, Connected apps (catalog stub — Gmail, Outlook, Google Calendar), Account (session and sign-out controls).

### Notifications

Bell popover inbox on Home (Apply and Paper events). Prototype-validated; ships after the shell.

## Product hosts

The public site lives at `opencv.me`; authentication and the signed-in workspace live at `app.opencv.me`. Public Pitch links remain at `opencv.me/u/<slug>`. Product language is English.

## Out of scope

- Search / job-board discovery (Users bring Opportunities in themselves).
- Publishing or scheduling social posts. Pitch publishes a portfolio link only.
- Real OAuth for Connected apps.
- Company/recruiter product.
- i18n / Vietnamese-first copy. English is the product language (Coach + chrome + starter content + receipts). No locale default or toggle. If a User writes in Vietnamese, the Coach may still answer as a model capability — that is not a configured feature.

## Open questions (created by the prototype, not settled)

1. **Naked Fit score.** Cards show a bare 0–100 number. Principle 1 says claims show their basis; anti-references warn against career-quiz astrology. Production Fit must either show its evidence or not ship as a number.
2. **Live GitHub APIs.** Pitch calls `api.github.com` and a third-party contributions API (`jogruber.de`) client-side. Dependency, rate limits, and privacy are undecided.
3. **Seed persona.** For real accounts: signup writes a neutral starter workspace (sample CV, a few Apply cards, one Thread, one Pitch document) in the product voice. "Eric Nguyen" is demo data only and must not appear. Pitch identity is the session User; the document stores portfolio content, not a fake name. The Pitch starter is labeled **Demo content** with Edit / Clear demo so it never reads as a real UIT/PM self. The Paper sample CV is labeled **Sample · replace anytime**; a real edit or **Make mine** renames it so it is no longer Sample internship CV. Apply starter cards are labeled **Demo** on the board and in the drawer so they never read as personal jobs.
4. **Pitch post drafts.** The pre-prototype "social post drafts" idea is out of the definition; whether it returns as a later Pitch phase is unresolved.

## Personality

Grounded, warm, honest — like a good older mentor: encouraging but not flattering; willing to push back with evidence. No hype, no gamified badges, no corporate-HR voice. English: second person, contractions OK, no exclamation marks. If a User writes in Vietnamese, the Coach may reply without a locale setting.

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
