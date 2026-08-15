<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes, APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Agent skills

### Issue tracker

GitHub Issues on `quanvu309/openpath`, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical roles, each label string equal to its name. See `docs/agents/triage-labels.md`.

### Domain docs

Product language: `CONTEXT.md`. Where a file goes: `docs/map.md`. How to read both: `docs/agents/domain.md`. Locked decisions: `docs/adr/`.

This repo has no `src/` tree. Do not invent one.

## Cursor Cloud specific instructions

Standard commands live in `README.md` and `docs/database.md`. Notes below are the
non-obvious, environment-specific gotchas for this VM.

### Node 24 is required, and the default `node` is not it

The repo pins Node 24 (`.nvmrc`, `engines`). Earlier Node cannot strip TS types, so
`npm test`/`npm run dev` fail on it. The VM's default `node` on `PATH` is **v22** and
it shadows nvm in **non-interactive** shells (the Shell tool). Interactive shells get
Node 24 automatically via `~/.bashrc`. For non-interactive commands, select Node 24
first, e.g. `source "$NVM_DIR/nvm.sh" && nvm use 24`, or prepend the nvm bin to `PATH`.
The startup update script already installs/uses Node 24 for `npm install`.

### Postgres runs locally, but is not auto-started

Accounts, sessions and per-account `AppState` need Postgres (see `docs/database.md`).
A local Postgres 16 is installed with database `openpath` and role `openpath`/`openpath`.
There is no systemd here, so start it each session with:
`sudo pg_ctlcluster 16 main start`. Connection settings live in `.env.local` (gitignored,
persists in the snapshot): `DATABASE_URL`/`TEST_DATABASE_URL` point at
`localhost:5432/openpath` and `SESSION_SECRET` is set. For `localhost`, `lib/db/client.ts`
disables TLS, so no certs are needed. Migrations are already applied; re-run
`npm run db:migrate` if the DB is ever recreated. Because `TEST_DATABASE_URL` is set,
`npm test` runs the full suite (DB tests included) rather than skipping them.

### The Coach needs an LLM key; everything else does not

The AI Coach (eve agent) calls OpenRouter and needs `OPENROUTER_API_KEY`. It is not set,
so Coach/agent replies fail (503) — this is expected. Auth, onboarding, Profile, CV,
Openings, etc. all work without it. To exercise the Coach, add `OPENROUTER_API_KEY` as a
secret. The eve agent boots automatically beside `next dev` (`npm run dev`); it is not a
separate service to start.

