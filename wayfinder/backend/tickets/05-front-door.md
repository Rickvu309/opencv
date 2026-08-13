# Front door: a sign-in the browser can actually present

- **Type:** `wayfinder:grilling`
- **Status:** closed
- **Assignee:** minhquanvu3902@gmail.com (via Claude)
- **Blocked by:** —
- **Map:** [Map, OpenPath backend on Eve](../map.md)

## Question

The agent's routes demand HTTP Basic and the app never asks for it. In production the
Coach fails on every turn with a 401, the fallback toast fires, and the demo runs on
canned replies while looking deployed. What does the demo account's front door look like?

One fact shapes everything: **browsers do not show the native Basic dialog for `fetch`.**
A 401 with `WWW-Authenticate: Basic` on a fetch response is just a failed request. The
challenge `httpBasic()` advertises is real, and no browser UI will ever answer it. The app
has to collect the credential itself.

### 1. The shape

- **A login screen for the agent only.** Collect the demo credential once, keep it in
  `localStorage`, attach it per request via `useEveAgent`'s `headers` function
  (`Authorization: Basic base64(user:pass)`). Function values re-resolve on every request,
  reconnects included, so this is the supported hook. App screens stay public; only the
  Coach requires sign-in.
- **Gate the whole app.** Next middleware checks a cookie, a login page sets it, and a
  custom `AuthFn` in `agent/channels/eve.ts` verifies the same cookie so app and agent
  share one front door. More honest for a product, more moving parts for a demo.

Recommendation: start with the first; it touches two files and no middleware. The second
is the upgrade path when the app itself should stop being public, and the `AuthFn` swap is
contained in the channel file either way.

### 2. What the door has to handle

- Wrong password: an inline message on the login surface, per `better-writing`, not a
  toast and never a silent retry loop.
- Signed out or credential cleared: the Coach's first failed turn should route to the
  login surface, not to the offline fallback. The fallback is for the agent being down,
  and a 401 is not that. `onError` currently cannot tell them apart; it must.
- `localDev()` keeps local work credential-free; nothing about dev changes.
- The credential is user-typed at runtime. It must never appear in a bundle, an env var
  the client can read, or a committed file.

### 3. Copy

The login surface is the first thing a demo visitor reads. Vietnamese, two fields, one
button, and the demo credential displayed right on it, since a demo gate that hides its
own key is just friction. Voice per `PRODUCT.md`.

## Resolution, 2026-08-04

Closed. Verified on the deployed domain, in the order the exit criterion asks for.

### 1, resolved: a door for the Coach only

The recommended shape, and it stayed small: `lib/coach/credential.ts` plus
`components/coach/sign-in.tsx`, no middleware, no cookie, no change to any app screen.
The rest of the app stays public; only the Coach costs model tokens, so only the Coach is
worth a door.

**The probe is the part worth keeping.** Access is checked once on mount by streaming a
session id that cannot exist. Route auth runs *before* the session lookup, so the status
is the whole answer and no model call is billed. Measured against production: `401` on a
bad credential, `200` on a good one. That is what lets the door appear before the user
types, instead of after their first question has been thrown away.

### 2, all four handled

- **Wrong password:** inline, next to the field, `role="alert"`, `aria-invalid` and
  `aria-describedby` wired. Never a toast, because an error the user must act on should
  not be able to dismiss itself.
- **Signed out mid-session:** `onError` cannot see a status, so a failed turn re-probes
  (free) and splits into two answers: 401 sends the user to the door, anything else takes
  the offline path. Without that split a signed-out user is downgraded to canned replies
  forever by a toast blaming a service that works. Verified: a poisoned credential shows
  the door with **no** offline toast.
- **`localDev()`:** unchanged, and confirmed. Local shows no door and stores no credential,
  because loopback is accepted and the probe returns 200.
- **A rejected credential is dropped** on every path that learns it is bad: mount probe,
  sign-in failure, and turn failure. Nothing can send a header the server has refused.

Also fixed while here: the `?q=` handoff waited for nothing and would have spent a turn
during "checking" or lost the question behind the door. It now waits for the probe.

### 3, copy

Vietnamese, two fields, one button, credential printed on the form, voice per `PRODUCT.md`.

### The ticket contradicts itself, and here is the call

It asks for the credential to be **displayed on the form**, and also that it **never
appear in a bundle**. Both cannot hold: anything printed on a form is in the bundle.
Printing it wins, because a shared demo whose password you must ask for is a demo nobody
sees.

What matters is being precise about what that password is for. It is **not a secret**: it
stops drive-by traffic from burning model tokens on an open endpoint, and nothing more.
The credential that does matter, `NVIDIA_API_KEY`, was checked and is **absent from both
the client and server bundles**. Changing the demo password means a redeploy, and it must
never be reused anywhere it would protect something real. Recorded in `sign-in.tsx` so the
next reader does not mistake it for an oversight.

### Verified on production

| Step | Result |
| --- | --- |
| Fresh browser, `/coach` | Door renders, composer hidden, credential shown |
| Wrong password | `"Email hoặc mật khẩu chưa đúng. Kiểm tra lại giúp mình nhé."` inline, credential discarded, still on the door |
| Correct password | Door gone, composer back, credential stored |
| Real question | Streamed Vietnamese answer citing the user's own profile (Power BI, CV, the internship) |
| Poisoned credential + reload | Door, **no** offline toast |
| Local dev | No door, no credential |

## Exit criterion

A fresh incognito browser on the deployed domain: open `/coach`, meet the front door, sign
in with the demo credential shown on it, ask a question, get a streamed answer. Enter a
wrong password first and read a helpful Vietnamese message. Full verification runs on the
deployed domain, so this closes after *Ship it*, but nothing in it waits to be built.
