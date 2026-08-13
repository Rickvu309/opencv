# Implementation Plan: WO-25

**Work Order:** WO-25 — Build sign-in, create-account, and sign-out UI with route gating

> **As-built.** Written after implementation during the 2026-08-13 audit. For this
> work order the plan did not precede the code, which
> `execution/execute-work-order.md` step 4 requires. WO-27 and WO-23 are the
> exceptions: their plans were written first, posted to the user, and approved
> before any code was written.

## Scope

Build sign-in, create-account, and sign-out UI with route gating

## Files

- `components/auth/auth-form.tsx`
- `components/auth/sign-out-item.tsx`
- `app/sign-in/page.tsx`
- `app/sign-up/page.tsx`
- `lib/auth/problems.ts`
- `components/app-sidebar.tsx`
- `app/page.tsx`

## Approach and decisions

- One form component for both moods; the two differ only in endpoint, words, and where errors sit.
- Sign-out replaces the page rather than routing, so the store cannot keep holding the account's state.
- The landing CTA now opens account creation, because answering onboarding before there is anywhere to put the answers loses them.

## Acceptance criteria and how each is met

- **AC-ACCT-001.1** — `/sign-up` posts to the sign-up route and navigates on success (`components/auth/auth-form.tsx`)
- **AC-ACCT-001.2** — `username-taken` renders beside the username field (`lib/auth/problems.test.ts`)
- **AC-ACCT-001.3** — required-field codes map to the field that failed (`lib/auth/problems.test.ts`)
- **AC-ACCT-002.1** — `/sign-in` posts and returns to `next` (`components/auth/auth-form.tsx`)
- **AC-ACCT-002.2** — `bad-credentials` renders under neither field (`lib/auth/problems.test.ts`)
- **AC-ACCT-003.1** — sign-out flushes the write queue, ends the session, replaces the page (`components/auth/sign-out-item.tsx`)
- **AC-ACCT-005.1** — proxy redirect verified live (`curl: /cv -> 307 /sign-in?next=%2Fcv`)
- **AC-ACCT-005.2** — landing and sign-up reachable signed out (`curl: 200`)

## Testing

Both pages render in Vietnamese and English; redirect target now exists and returns 200.

## Scope notes

`/dev/chat` is gated with the rest of the app, which WO-25 named as an acceptable resolution.
