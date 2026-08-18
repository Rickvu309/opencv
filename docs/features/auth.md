# Auth

**Track:** Commodity — standard email + password sessions. Deliberately the most boring feature in the product.

**Job:** each user's work is theirs, saved to the server, and there when they return — on any device.

**Layout:** Narrow form at `/sign-in` and `/sign-up` — no rail, no dock. Heading, one sentence, the fields, one primary, a text link to the other mode ([layout.md](../design-system/layout.md)).

## Concept

Email and password, a session cookie, and a gate in front of the signed-in area. No email verification, password reset, social login, or MFA in v1; the module isolates auth so each can be added later without touching features.

## Screens

- `/sign-up` — email and password. Taken email: ask to sign in instead. Errors name the field.
- `/sign-in` — a wrong pair is rejected without revealing which half was wrong. One next step on the error.
- Sign out lives in Settings and the account menu.

## Mechanics

- Passwords hashed with bcrypt; never recoverable.
- Session token is random; the `sessions` row stores its SHA-256, never the token. Cookie is httpOnly, secure, sameSite lax. Sessions expire and renew on activity.
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
