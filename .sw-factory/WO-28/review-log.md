# Review Log: WO-28

**Work Order:** WO-28 — Move Coach conversation history to the account server store

## Round 1 — 2026-08-13

**Reviewer:** implementation agent, inline.
**Scope:** `git diff f7c8840..HEAD` limited to the paths owned by this work order.

### Requirements alignment

- **AC-ACCT-004.2** — the account comes from the session (`app/api/coach/conversations/route.ts`)
- **AC-ACCT-004.3** — threads present on a second device (`lib/coach/account-conversations.test.ts`)
- **AC-ACCT-004.4** — cross-account isolation test (`lib/coach/account-conversations.test.ts`)

Verdict for this dimension: **pass**. Every acceptance criterion on the linked
requirements document that this work order owns is implemented and covered by a
test or by recorded live verification.

### Blueprint alignment

Components and contracts follow the linked blueprints:

- Own table, not `app_state`: the two are written at different moments, and sharing a row would have every CV keystroke rewriting the chat history under last-write-wins.
- The list is read on the server and handed to the provider as a prop, because the thread reads it in a `useState` initialiser where a promise cannot be awaited.
- A two-second quiet period rather than the state store's 700ms: a conversation saves on every stream event and the document is the whole transcript.
- A signed-in tab never falls back to this browser's list, so a shared device cannot show one person another's threads.

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

Verified live: save two threads, sign in with a fresh jar, both present; a second account sees neither.

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
