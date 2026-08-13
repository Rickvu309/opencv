# Review Log: WO-23

**Work Order:** WO-23 — Build account and session backend (create, sign-in, sign-out)

## Round 1 — 2026-08-13

**Reviewer:** implementation agent, inline.
**Scope:** `git diff f7c8840..HEAD` limited to the paths owned by this work order.

### Requirements alignment

- **AC-ACCT-001.1** — sign-up route creates the account and starts the session (`lib/auth/accounts.test.ts`)
- **AC-ACCT-001.2** — unique index on lower(username); route answers `username-taken` (`lib/auth/accounts.test.ts`)
- **AC-ACCT-001.3** — empty field named precisely by `checkNew` (`lib/auth/accounts.test.ts`)
- **AC-ACCT-001.4** — bcrypt cost 10; test asserts the stored value is a bcrypt hash and not the password (`lib/auth/accounts.test.ts`)
- **AC-ACCT-002.1** — `verifyCredentials` then `startSession` (`lib/auth/sessions.test.ts`)
- **AC-ACCT-002.2** — one `bad-credentials` code for both paths, plus a decoy hash so the timing matches (`lib/auth/accounts.test.ts`)
- **AC-ACCT-002.3** — cookie expiry equals the row expiry; repeated reads succeed (`lib/auth/sessions.test.ts`)
- **AC-ACCT-003.1** — `endSession` deletes the row and clears the cookie (`lib/auth/sessions.test.ts`)
- **AC-ACCT-003.2** — the deleted row makes every copy of the cookie worthless (`lib/auth/sessions.test.ts`)
- **AC-ACCT-005.1** — `gateFor` redirects every product screen (`lib/auth/gate.test.ts`)
- **AC-ACCT-005.2** — `/`, `/sign-in`, `/sign-up` are allow-listed (`lib/auth/gate.test.ts`)

Verdict for this dimension: **pass**. Every acceptance criterion on the linked
requirements document that this work order owns is implemented and covered by a
test or by recorded live verification.

### Blueprint alignment

Components and contracts follow the linked blueprints:

- bcryptjs rather than native bcrypt: same algorithm, no native build on Vercel functions.
- Cookie is `<token>.<hmac>`; the row is keyed by `sha256(token)`, so a database dump holds no usable session.
- Route handlers answering stable codes, matching `app/api/waitlist/route.ts`, because the server cannot know the reader's language.
- Gating is a pure function (`gateFor`) with `proxy.ts` as a thin adapter, so the rule is testable without running the app.

Verdict for this dimension: **pass**.

### Architecture and conventions

Placement, naming and error handling follow the surrounding code: stable failure
codes as `app/api/waitlist/route.ts` established, `{ vi, en }` pairs for every
user-facing string, design tokens rather than raw hex, and every state change
through the action registry.

Verdict for this dimension: **pass**.

### Tests and build health

`npm test` 282 passing, 0 failing. `npm run lint` clean. `npx tsc --noEmit`
clean. `npm run build` succeeds.

Baseline note, not caused by this work: the repository requires Node 24 and the
machine had Node 22, on which the whole suite fails to load because Node 22 does
not strip TypeScript types. Node 24 was installed locally rather than changing
the repository's scripts.

Verdict for this dimension: **pass**.

### User-facing verification

41 auth tests pass. Verified live against the running app: gated route 307s to /sign-in, sign-up opens it, repeat username refused, sign-out closes it.

No browser automation tool is configured in this environment, so exploratory
checks were made with HTTP requests against the running dev server rather than a
rendered browser session. Layout and visual regressions are therefore **not**
covered by this review and remain unverified.

Verdict for this dimension: **pass, with the stated limit**.

### Security, privacy and data safety

Reviewed for this work order: authentication and session handling, input
validation at every boundary, secrets kept out of tracked files and out of logs,
per-account isolation, and migration safety. No secret or credential appears in
a tracked file; no log line carries a password, a token or a state body.

Verdict for this dimension: **pass**.

### Findings

No blocking findings. No advisory findings recorded for this work order.

### Verdict

**APPROVED**
