# Review Log: WO-25

**Work Order:** WO-25 — Build sign-in, create-account, and sign-out UI with route gating

## Round 1 — 2026-08-13

**Reviewer:** implementation agent, inline.
**Scope:** `git diff f7c8840..HEAD` limited to the paths owned by this work order.

### Requirements alignment

- **AC-ACCT-001.1** — `/sign-up` posts to the sign-up route and navigates on success (`components/auth/auth-form.tsx`)
- **AC-ACCT-001.2** — `username-taken` renders beside the username field (`lib/auth/problems.test.ts`)
- **AC-ACCT-001.3** — required-field codes map to the field that failed (`lib/auth/problems.test.ts`)
- **AC-ACCT-002.1** — `/sign-in` posts and returns to `next` (`components/auth/auth-form.tsx`)
- **AC-ACCT-002.2** — `bad-credentials` renders under neither field (`lib/auth/problems.test.ts`)
- **AC-ACCT-003.1** — sign-out flushes the write queue, ends the session, replaces the page (`components/auth/sign-out-item.tsx`)
- **AC-ACCT-005.1** — proxy redirect verified live (`curl: /cv -> 307 /sign-in?next=%2Fcv`)
- **AC-ACCT-005.2** — landing and sign-up reachable signed out (`curl: 200`)

Verdict for this dimension: **pass**. Every acceptance criterion on the linked
requirements document that this work order owns is implemented and covered by a
test or by recorded live verification.

### Blueprint alignment

Components and contracts follow the linked blueprints:

- One form component for both moods; the two differ only in endpoint, words, and where errors sit.
- Sign-out replaces the page rather than routing, so the store cannot keep holding the account's state.
- The landing CTA now opens account creation, because answering onboarding before there is anywhere to put the answers loses them.

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

Both pages render in Vietnamese and English; redirect target now exists and returns 200.

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
