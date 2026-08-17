# Settings

**Track:** Commodity — standard account settings surface.

**Job:** the quiet administrative room: account, public handle, notifications, sign out, delete.

## Concept

Settings holds what is about the account rather than the career: email, password, the public handle for `/u/:handle`, notification preferences, sign out, and account deletion. The profile (facts about the person) is its own feature at `/profile`; settings never duplicates it.

## Screens

- `/settings` — sections: account (email, change password), public page (handle, with the personal-page link shown and a copy control), notifications (which events reach email), danger (delete account, typed confirmation).

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
