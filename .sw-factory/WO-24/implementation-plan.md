# Implementation Plan: WO-24

**Work Order:** WO-24 — Store AppState per account on the server behind dispatch

> **As-built.** Written after implementation during the 2026-08-13 audit. For this
> work order the plan did not precede the code, which
> `execution/execute-work-order.md` step 4 requires. WO-27 and WO-23 are the
> exceptions: their plans were written first, posted to the user, and approved
> before any code was written.

## Scope

Store AppState per account on the server behind dispatch

## Files

- `lib/state/account-state.ts`
- `lib/state/server.ts`
- `app/api/state/route.ts`
- `lib/actions/persistence.ts`
- `lib/actions/store.tsx`
- `app/layout.tsx`

## Approach and decisions

- State is read on the server and handed to the store as a prop, so hydration matches and there is no flash of an empty profile.
- Writes coalesce on a 700ms quiet period and flush on `pagehide`; localStorage was free and synchronous, a row in Southeast Asia is neither.
- Signed out still means localStorage, which is all the landing page's language toggle needs.
- Reading the session in the root layout makes every route dynamic. Accepted: the product is per-user now.

## Acceptance criteria and how each is met

- **AC-ACCT-001.5** — `createAccountState` runs in the same transaction as account creation (`lib/state/account-state.test.ts`)
- **AC-ACCT-004.1** — `app_state` row keyed by account id (`lib/state/account-state.test.ts`)
- **AC-ACCT-004.2** — the account comes from the session; no caller-supplied id reaches the query (`app/api/state/route.ts`)
- **AC-ACCT-004.3** — second device reads the same row (`lib/state/account-state.test.ts`)
- **AC-ACCT-004.4** — cross-account read/write test (`lib/state/account-state.test.ts`)

## Testing

Verified live: create account, save work, sign out, sign in with a fresh cookie jar, same work present; a second account sees none of it.

## Scope notes

No reducer, action or screen changed, which is what the dispatch seam existed for.
