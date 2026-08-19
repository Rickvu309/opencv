# Auth

**Track:** Commodity — standard email + password sessions. Deliberately the most boring feature in the product.

**Job:** each user's work is theirs, saved to the server, and there when they return — on any device.

**Layout:** Auth card at `/sign-in` and `/sign-up` (form + mark panel). No rail, no dock.

## Concept

Email and password, a session cookie, and a gate in front of the signed-in area. No email verification, password reset, social login, or MFA in v1; the module isolates auth so each can be added later without touching features.

## Screens

- `/sign-up` — auth card: email, then password and confirm password side by side from `sm`. Hint under the pair: "Use at least 8 characters." Mismatched confirm: "Passwords must match." Taken email: ask to sign in instead. Errors name the field. Sign-up always keeps the session for 30 days. No social login.
- `/sign-in` — the same auth card as sign-up (same width and `min-h-[36rem]`). A wrong pair is rejected without revealing which half was wrong. One next step on the error. **Keep me signed in** (default on): a 30-day cookie that renews while they use the app. Unchecked: the session lasts until the browser closes. Production Storybook `Screens/Auth` is fullscreen so both modes show this card; Lab `Lab/Templates/Auth` is sourced catalog, not this shell.
- Sign out lives in Settings and the account menu.

## Mechanics

- Passwords hashed with bcrypt; never recoverable.
- Session token is random; the `sessions` row stores its SHA-256, never the token. Cookie is httpOnly, secure, sameSite lax.
- Remembered sessions expire in 30 days and renew on activity once past the halfway mark (`readSession` bumps `expires_at` and refreshes the cookie via `meFn`). Unchecked sign-in sets a browser-session cookie and a 1-day `expires_at`.
- Expired session rows are deleted by the `session.purge` worker job.
- Request middleware resolves the session once; every query and command receives the user id from it. Signed-out access to `_app` routes redirects to `/sign-in`; `/`, auth pages, `/p/$slug`, and `/u/$handle` stay public.
- Auth itself does not run on the command bus — sign-up and sign-in have no authenticated actor yet. They are dedicated server functions in `features/auth/`, the one sanctioned exception, documented here so nobody generalizes from it.

## Data

`users`, `sessions` ([data.md](../data.md)). Deleting a user cascades everything they own.

## Commands

| Command | Agent | What |
|---|---|---|
| `account.remove` | no | Delete the account and everything in it. Destructive: typed confirmation, not a click |

## Out of scope

Email verification, password recovery, social login, MFA, roles and teams. Each is an addition to this module when the product earns it.
