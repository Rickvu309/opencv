# Settings

**Track:** Commodity — standard account settings surface.

**Job:** the quiet administrative room: account, public handle, notifications, sign out, delete.

**Layout:** Sectioned editor at `/settings` — account, public page, notifications, danger last. No global primary; destructive actions confirm via Overlay. The dock must not cover section actions ([layout.md](../layout.md)).

## Concept

Settings holds what is about the account rather than the career: email, password, the public handle for `/u/:handle`, notification preferences, sign out, and account deletion. The profile (facts about the person) is its own feature at `/profile`; settings never duplicates it.

## Screens

- Reached from the account control, not the core rail ([flows.md](../flows.md) edge-case nav). Nothing here is in Prepare or Opportunities.
- `/settings` — sections: account (email, change password), public page (handle, with the personal-page link shown and a copy control), notifications (which events reach email), danger (delete account, typed confirmation). The Coach dock travels here; the Coach still cannot call account commands.

## Data

Reads `users`, `handles`, notification preferences (a JSONB column on `users`) ([data.md](../data.md)).

## Commands

| Command | Agent | What |
|---|---|---|
| `account.updateEmail` | no | With current-password check |
| `account.updatePassword` | no | With current-password check |
| `share.setHandle` | no | Owned by [share.md](share.md); surfaced here |
| `account.setNotificationPrefs` | no | Which kinds reach email |
| `account.remove` | no | Owned by [auth.md](auth.md); typed confirmation |

Nothing here is agent-callable. The Coach does not touch account administration.

## Out of scope

Billing and plans (monetization is deferred), theme switching, language switcher (deferred), sessions management UI.
