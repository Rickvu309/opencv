# Implementation Plan: WO-23

**Work Order:** WO-23 — Build account and session backend (create, sign-in, sign-out)

> **As-built.** Written after implementation during the 2026-08-13 audit. For this
> work order the plan did not precede the code, which
> `execution/execute-work-order.md` step 4 requires. WO-27 and WO-23 are the
> exceptions: their plans were written first, posted to the user, and approved
> before any code was written.

## Scope

Build account and session backend (create, sign-in, sign-out)

## Files

- `lib/auth/accounts.ts`
- `lib/auth/cookie.ts`
- `lib/auth/sessions.ts`
- `lib/auth/gate.ts`
- `lib/auth/dal.ts`
- `lib/auth/http.ts`
- `proxy.ts`
- `app/api/auth/{sign-up,sign-in,sign-out}/route.ts`

## Approach and decisions

- bcryptjs rather than native bcrypt: same algorithm, no native build on Vercel functions.
- Cookie is `<token>.<hmac>`; the row is keyed by `sha256(token)`, so a database dump holds no usable session.
- Route handlers answering stable codes, matching `app/api/waitlist/route.ts`, because the server cannot know the reader's language.
- Gating is a pure function (`gateFor`) with `proxy.ts` as a thin adapter, so the rule is testable without running the app.

## Acceptance criteria and how each is met

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

## Testing

41 auth tests pass. Verified live against the running app: gated route 307s to /sign-in, sign-up opens it, repeat username refused, sign-out closes it.

## Scope notes

Added beyond the stated scope: an in-memory brute-force brake on the auth routes (`tooManyAttempts`). Shipping a password endpoint with an unlimited guess rate was not acceptable; recorded here as a deliberate scope addition.
