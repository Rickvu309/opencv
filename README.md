# OpenPath

An AI career coach for Vietnamese students and new graduates. It reads your
profile, shows the roles you can realistically reach, turns the gap into a plan
you can work through week by week, and builds the CV you send.

Live: [openpath.up.railway.app](https://openpath.up.railway.app)

The product UI is English. The code and internal docs are English.

## Status

Live and working, with the limits of a demo. What that means:

- The Coach is real. An Eve agent runs on Railway beside the app and answers
  in English.
- It can change the app for you. Ask it to add a line to your CV and the line
  appears, with an undo.
- **Real accounts.** A username and a password, and everything behind the
  landing page needs one. Auth is deliberately minimal this phase: no email
  verification, no social login, and **no password recovery**, so a forgotten
  password is a lost account.
- **Your work is on the server, under your account.** Sign in on another device
  and it is there. Postgres on Railway holds it; see `docs/database.md`.
- **An account starts empty.** There is no seeded persona any more. Onboarding
  is where the profile comes from, and every screen reads the store, so what
  you type is what the app shows you.
The waiting list is stored in the same Postgres as the accounts.

## Run it

Node 24 is required, and `.nvmrc` pins it. Earlier versions do not strip
TypeScript types, so `npm test` fails to load a single file on them.

```bash
nvm use         # reads .nvmrc
npm install
npm run dev     # http://localhost:3000
```

Accounts need a database. Put `DATABASE_URL` and `SESSION_SECRET` in
`.env.local`, then apply the schema. `docs/database.md` has both values and the
rest of the setup.

```bash
npm run db:migrate   # apply the schema
npm run db:status    # what is applied, what is pending
```

Other commands:

```bash
npm run build   # production build
npm test        # the registry, the CV, the copy catalog, accounts, storage
npm run lint
```

## How it fits together

**Every change goes through one registry.** The UI dispatches when you click.
The Coach calls the same actions as tools. Both go through
`lib/actions/store.tsx`, so a Coach edit is indistinguishable from yours, with
undo.

The Coach does not write AppState itself. It validates and returns an envelope;
the browser applies it. `CONTEXT.md` is the glossary. `docs/map.md` is the
one-page picture.

```
lib/actions/
  registry.ts    every change the app can make, one definition each
  store.tsx      the one way state changes; UI and Coach both call it
  context.ts     what the Coach is allowed to see, sent on every turn
  persistence.ts where your work is kept between visits
  types.ts       the shape the Coach is allowed to see and change
  seed.ts        the state a new account starts from, deliberately empty
  fixture.ts     a populated account for tests, built by dispatching
```

The agent is a sibling, not a service you run separately:

```
agent/
  agent.ts            the model, and the two settings it needs
  instructions.md     who the Coach is
  channels/eve.ts     who is allowed to reach it
  tools/apply_action.ts  validates; the browser applies the envelope
```

## Copy

The product is English. `lib/i18n/messages.ts` holds the interface copy.
Role descriptions, document kinds, and action confirmations live next to the
code they describe. A CV can still record its own language for the document.

## Screens

Five feature screens, then Coach:

- **My Profile** (`/profile`) — who you are. Lives in the account menu.
- **My Paper** (`/paper`) — a Drive of papers. CV, cover letter, Proof, and
  uploaded files. Open one at `/paper?id=`. Published Proofs are `/p/[slug]`.
- **My Pitch** (`/pitch`) — bio, self-intro, interview answers.
- **My Search** (`/search`) — openings ranked against the profile.
- **My Application** (`/applications`) — the board of applications you are in.

**My Coach** (`/coach`) is the conversation. The dock on every other screen is
the same conversation, not a second one.

Each feature has one URL, one AppState field, one action prefix, and a
folder trio: `app/(app)/<name>`, `lib/<name>`, and `components/<name>` when
the screen has shared UI. Search stores **openings**; Application stays at
`/applications`. `lib/actions/` is the write spine — not five stores.

Under those: Discover (landing), onboarding, accounts, Help, Plan and billing.

Onboarding asks the goal first, then where you are starting from, then what
you already have — and shows a fit score that moves as you answer, because a
form that gives nothing back until the end is a form nobody finishes.

## Stack

Next.js 16, React 19, TypeScript, Tailwind v4, shadcn/ui. The app, the Coach
and Postgres all run on Railway. Accounts add bcrypt for the password hashes
and a signed HTTP-only cookie for the session. Tests run on Node's built-in
runner.

## Docs

- `CONTEXT.md`: product words (features, Paper vs vault, Coach vs AppState).
- `docs/map.md`: how a click and a Coach turn both hit `dispatch`.
- `PRODUCT.md`: who this is for, and the design principles.
- `DESIGN.md`: the visual system. Colour, type, motion, and how a Coach edit
  behaves.
- `docs/database.md`: where the database is, and how to apply the schema.
- `docs/hosting.md`: Railway topology (app, agent, Postgres).
- `docs/agents/`: issue tracker, triage labels, and how skills read domain docs.
- `.scratch/`: local markdown tickets and specs.
