# Implementation Plan: WO-26

**Work Order:** WO-26 — Migrate Coach agent auth from shared credential to user session

> **As-built.** Written after implementation during the 2026-08-13 audit. For this
> work order the plan did not precede the code, which
> `execution/execute-work-order.md` step 4 requires. WO-27 and WO-23 are the
> exceptions: their plans were written first, posted to the user, and approved
> before any code was written.

## Scope

Migrate Coach agent auth from shared credential to user session

## Files

- `agent/channels/session.ts`
- `agent/channels/eve.ts`
- `lib/coach/access.ts`
- `components/coach/session-ended.tsx`
- `components/coach/thread.tsx`
- `lib/auth/cookie.ts`

## Approach and decisions

- Custom `AuthFn` reading the session cookie; the account is the principal on the turn.
- Fails closed on a missing secret or an unreachable database: an agent that opened itself because it could not check would be billed in model tokens.
- The offline-versus-locked distinction is re-derived from the session probe, which still costs no model call.
- `lib/coach/credential.ts` and the Coach's own sign-in form are deleted.

## Acceptance criteria and how each is met

- **AC-ACCT-005.1** — the agent refuses a request with no live session (`agent/channels/session.test.ts`)
- **AC-ACCT-002.3** — a live session authorizes the turn as that account (`agent/channels/session.test.ts`)

## Testing

7 agent auth tests pass, including a tampered cookie, an expired session, a signed-out session and a missing secret.

## Scope notes

`OPENPATH_DEMO_USER` and `OPENPATH_DEMO_PASSWORD` are no longer read anywhere.
