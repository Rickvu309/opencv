# OpenPath

An AI career coach for Vietnamese students and new graduates. It reads your
profile, shows the roles you can realistically reach, turns the gap into a plan
you can work through week by week, and builds the CV you send.

Live: [openpath-app.vercel.app](https://openpath-app.vercel.app)

The interface is Vietnamese or English, switchable anywhere. The code and
internal docs are English.

## Status

Live and working, with the limits of a demo. What that means:

- The Coach is real. An Eve agent runs alongside the app on Vercel and answers
  in your language in about five seconds.
- It can change the app for you. Ask it to add a task and the task appears,
  with an undo. Ask it to sharpen a bullet in your CV and you watch that line
  change.
- **Real accounts.** A username and a password, and everything behind the
  landing page needs one. Auth is deliberately minimal this phase: no email
  verification, no social login, and **no password recovery**, so a forgotten
  password is a lost account.
- **Your work is on the server, under your account.** Sign in on another device
  and it is there. Postgres on Railway holds it; see `docs/database.md`.
- **An account starts empty.** There is no seeded persona any more. Onboarding
  is where the profile comes from, and every screen reads the store, so what
  you type is what the app shows you.
- **Two languages, neither one a translation.** Vietnamese and English are
  written separately, and the Coach answers in whichever you are reading.

The waiting list is the one thing stored centrally.

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

One idea carries most of the design: **every change to the app goes through one
registry.**

`lib/actions/registry.ts` holds 41 actions across seven groups (profile,
documents, plan, todos, career paths, CVs, settings). Each one is a description
the model reads, a Zod schema that validates the input, and a pure reducer.

The UI dispatches those actions when you click. The Coach calls the same set as
tools. Because both go through `lib/actions/store.tsx`, a change the Coach makes
is indistinguishable from one you make yourself, and it shows up everywhere at
once.

That is where persistence and the Coach's context are written: once, behind
`dispatch`, rather than 41 times. Persistence moved from the browser to a row
per account without a single action or screen changing, which is what having
that seam was for.

```
lib/actions/
  registry.ts   every change the app can make, one definition each
  store.tsx     the one way state changes; UI and Coach both call it
  context.ts    what the Coach is allowed to see, sent on every turn
  persistence.ts where your work is kept between visits
  types.ts      the shape the Coach is allowed to see and change
  seed.ts       the state a new account starts from, deliberately empty
  fixture.ts    a populated account for tests, built by dispatching
lib/
  catalog.ts    the app's fixed vocabulary: kinds of thing, and their weights
  cv/           the CV itself: types, building one, and getting it back out
  i18n/         every word the product says, in both languages
```

The CV is the clearest case for the registry. Fourteen of the forty-one actions
are `resume.*`, because the Coach has to be able to rewrite one bullet without
resending the document, and a whole-document write is the one edit that can
silently delete work you did between turns.

The agent is a sibling, not a service you run separately:

```
agent/
  agent.ts            the model, and the two settings it needs
  instructions.md     who the Coach is
  channels/eve.ts     who is allowed to reach it
  tools/apply_action.ts  the Coach's hands, wired to the registry above
```

## Two languages

Every user-facing string is a `{ vi, en }` pair, and the pairs are written
separately rather than translated. `PRODUCT.md` calls the voice "Vietnamese-first,
natural not translated", which cuts both ways once English exists: Vietnamese
bent to fit an English sentence reads like a manual, and English mirroring
Vietnamese reads like a machine.

`lib/i18n/messages.ts` holds the interface copy. Content that is not interface
copy keeps its pairs where it lives: role descriptions in `lib/career-graph.ts`,
document kinds in `lib/catalog.ts`, action confirmations in the registry beside
the reducers they announce.

The language is part of `AppState`, not a setting beside it, for one reason: the
Coach has to know. Switching to English and getting a Vietnamese reply is the
half of the product that talks ignoring you. `settings.setLanguage` is an action
like any other, so the Coach can switch when you write to it in the other one.

A CV carries its **own** language, separate from the app's. Applying abroad
means an English CV, and needing to switch the whole interface to write one
would be the wrong trade.

`npm test` guards the catalog: every leaf has both languages, no English entry
still carries Vietnamese text, and every one of the 41 actions can announce
itself in both.

## Screens

Eight: a landing page, a three-step onboarding flow, and six app screens
(Coach, Hồ sơ, CV, Career Map, Kế hoạch, Todo).

Onboarding asks the goal first, then where you are starting from, then what
you already have — and shows a fit score that moves as you answer, because a
form that gives nothing back until the end is a form nobody finishes.

The Coach is the home screen. Every other screen is an artifact the
conversation produced or reads from.

`/cv` is the one that leaves the building. It builds a CV from the profile you
already filled in, previews it at A4, and exports it as PDF (through the
browser's own print dialog), Markdown, plain text, or JSON.

## Stack

Next.js 16, React 19, TypeScript, Tailwind v4, shadcn/ui. Accounts add Postgres
on Railway (`pg`), bcrypt for the password hashes, and a signed HTTP-only
cookie for the session. Tests run on Node's built-in runner.

## Docs

- `PRODUCT.md`: who this is for, and the design principles.
- `DESIGN.md`: the visual system. Colour, type, motion, and how a Coach edit
  behaves.
- `docs/database.md`: where the database is, and how to apply the schema.
- `agent-native.md`: the technical spec for embedding the Coach.
- `wayfinder/`: the working maps of what is decided and what is still open.
  `backend/` and `launch/` are complete; the UI/UX effort is archived.
