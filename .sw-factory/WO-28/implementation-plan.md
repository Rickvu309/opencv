# Implementation Plan: WO-28

**Work Order:** WO-28 — Move Coach conversation history to the account server store

> **As-built.** Written after implementation during the 2026-08-13 audit. For this
> work order the plan did not precede the code, which
> `execution/execute-work-order.md` step 4 requires. WO-27 and WO-23 are the
> exceptions: their plans were written first, posted to the user, and approved
> before any code was written.

## Scope

Move Coach conversation history to the account server store

## Files

- `lib/db/migrations/004_conversations.*.sql`
- `lib/coach/account-conversations.ts`
- `lib/coach/server.ts`
- `lib/coach/sessions.ts`
- `app/api/coach/conversations/route.ts`
- `components/coach/provider.tsx`
- `app/(app)/layout.tsx`

## Approach and decisions

- Own table, not `app_state`: the two are written at different moments, and sharing a row would have every CV keystroke rewriting the chat history under last-write-wins.
- The list is read on the server and handed to the provider as a prop, because the thread reads it in a `useState` initialiser where a promise cannot be awaited.
- A two-second quiet period rather than the state store's 700ms: a conversation saves on every stream event and the document is the whole transcript.
- A signed-in tab never falls back to this browser's list, so a shared device cannot show one person another's threads.

## Acceptance criteria and how each is met

- **AC-ACCT-004.2** — the account comes from the session (`app/api/coach/conversations/route.ts`)
- **AC-ACCT-004.3** — threads present on a second device (`lib/coach/account-conversations.test.ts`)
- **AC-ACCT-004.4** — cross-account isolation test (`lib/coach/account-conversations.test.ts`)

## Testing

Verified live: save two threads, sign in with a fresh jar, both present; a second account sees neither.

## Scope notes

Caps and the first-question naming rule are unchanged, and re-applied server side.
