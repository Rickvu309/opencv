# OpenPath

OpenPath is an AI-native career workspace prototype. It helps a job seeker
organize opportunities, understand which ones deserve attention, decide
what to do next, adapt profile and CV materials per opportunity, and build
long-term career memory (track record, goals, skills). The embedded
Copilot participates in the work throughout, not as a bolted-on chat
window: it drafts and proposes, the user always accepts, edits, or
dismisses. A second, distinct persona mode at `/recruiter/*` shows the same
product from a talent lead's side of the table: pipeline review, decisions,
outreach, and submission to a hiring manager.

This is a high-fidelity, mock-data prototype, not a shipped product. Read
this file before changing anything.

## What the prototype includes

**Two modes, one design system.**

- **Candidate mode** (`/home` and everything under it): Home, Opportunities
  (Active and Watchlist lenses, board and list views, comparison), the
  opportunity detail workspace (Overview, AI Analysis, Actions, Materials,
  Activity), Strategy (the weekly pipeline coach), Sources (connected
  tools and the synced-context inbox), Rewind (the connected weekly
  review), Proof Builder, career memory (Profile, CV Versions, Track
  Record), and direction (Path Planner, Roadmap, Goals, Skills & Learning).
  Persona: Mai Tran, a senior product designer in Ho Chi Minh City moving
  toward AI product work.
- **Recruiter mode** (`/recruiter/*`): its own sidebar and route group,
  never a reskin of the candidate side. Pipeline, Roles, and Candidates
  indexes, plus a candidate detail page with AI summary, stage history,
  Review, Decision, Outreach, and Submission workflows. Persona: Lan Pham,
  talent lead at the fictional Saola Labs. Reachable from either mode's
  persona chip ("Switch to recruiter mode" / "Switch to candidate mode").
- **Public landing page** (`/`): a marketing narrative (hero, problem and
  thesis, how it works, four live-component showcases, the AI difference,
  recruiter mode, closing CTA). Unlike the rest of the app, it is fully
  responsive down to mobile.

**Honestly labeled as a prototype:**

- **Scripted AI, not a real model.** Every Copilot response, insight, and
  suggestion is a canned TypeScript object in `lib/data/`, keyed to the
  specific object it's about. There is no API call to any AI provider.
- **No persistence.** All state lives in one client-side store (React
  context plus a reducer). It resets on every reload by design; nothing is
  saved to a database, `localStorage`, or `sessionStorage`.
- **Desktop app, not a general web app.** Below 1024px, every app and
  recruiter route shows a polite "OpenPath is a desktop product" guard. The
  landing page is the one exception: it holds down to phone widths since
  it's marketing, not the workspace.

## How to run it

Requires Node.js and npm.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app lands on the
public landing page; "Open OpenPath" routes into onboarding on a first
visit, or straight to `/home` if onboarding was already completed this
session.

Other scripts:

```bash
npm run lint        # ESLint
npx tsc --noEmit     # Type check
npm run build        # Production build
```

## How to deploy it

Deployed on Vercel. The direct CLI deploy (`vercel deploy --prod`) has
silently dropped tracked source files in this project before; use the
prebuilt path instead:

```bash
vercel build --prod
vercel deploy --prebuilt --prod --yes
```

The canonical alias is `openpath-app.vercel.app` (the unsuffixed
`openpath.vercel.app` is taken globally), and it does not follow a new
deployment automatically. Repoint it explicitly after every deploy:

```bash
vercel alias set <deployment-url> openpath-app.vercel.app
```

## Documentation index

Read in this order when picking up the project:

- `CONTEXT.md`: domain vocabulary. The exact words to use in code, UI copy,
  tickets, and commits (Opportunity, Fit, Copilot, trust boundary, and the
  parallel recruiter-mode vocabulary).
- `docs/architecture.md`: the structural foundation. Product intent, stack,
  app structure and navigation, the user-flow map, the object model, the
  mock data blueprint, the simulated-AI behavior model, and a ticket map
  tying every surface back to the ticket that built it.
- `docs/design.md`: the visual design authority. Color, type scale,
  spacing, radius, density per page template, state language, and icon
  rules. If a component disagrees with this file, the component is wrong.
- `docs/delivery-map.md`: an index of what each ticket actually shipped and
  where it lives, verified against the current code rather than taken from
  ticket descriptions.
- `docs/lessons.md`: a running log of reusable lessons learned while
  building this prototype, newest last.
- `docs/qa-16.md` and `docs/qa-final.md`: the two full-product QA records.
  `qa-16.md` closed the original 18-ticket build; `qa-final.md` closed the
  9 tickets after it (RDS-984 through RDS-994) plus the recruiter mode and
  landing page work.

## Contributor notes

- **Domain language is not optional.** Use `CONTEXT.md`'s exact terms.
  Never call an Opportunity a "job" or "application" in code or copy. Dream
  is a flag, not a status. There is one Copilot, never "assistants."
  Recruiter mode reuses two of these words on purpose for its own
  vocabulary ("Candidate," "Role"); every recruiter-mode type carries an
  explicit `Recruiter` prefix in code so the two meanings can never collide
  as TypeScript symbols, even though they collide on purpose in English.
- **`docs/design.md` is the design authority.** If a component disagrees
  with it, fix the component, not the doc, unless the fix reveals the rule
  itself was wrong, then update both together.
- **The trust boundary is absolute.** The Copilot drafts and suggests; the
  user accepts, edits, or dismisses. Nothing AI-generated applies itself,
  anywhere in the product.
- **No em dashes or en dashes as punctuation**, anywhere: code comments,
  UI copy, docs, commit messages. Use a comma, colon, parentheses, or two
  sentences. Hyphens in compound words are fine.
- **Commit authorship convention:** commits in this repository are authored
  as `Rick Vu <minhquanvu3902@gmail.com>`, with no AI attribution trailer
  or footer.
- **npm only.** Don't introduce yarn or pnpm lockfiles.
