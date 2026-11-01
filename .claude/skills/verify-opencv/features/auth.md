# Auth

Auth lets a visitor sign in with an email code, sign out, and sign in again. The first code writes profile defaults only. A new account has no sample CV, no Apply cards, and no welcome thread. The account name stays empty.

## Sub-features

- `auth-code` sends a code, shows Welcome, then lands on the start page, `/apply`.
- `auth-guard` redirects a signed-out visit to `/apply` to `/sign-in`.
- `auth-signout` ends the session from Settings.
- `auth-signin` signs back in by code and lands on `/apply` without Welcome.
- `auth-wrong-code` shows an inline error and stays on `/sign-in`.
- `auth-language` stores VI and leaves the heading in English.

## How to get to it (user POV)

- Open `/sign-in`. The heading is `Log in to opencv`. There is no Password field.
- Fill Email `ada@verify.local`, choose `Continue`.
- Read the code from `api.log` with `^\[auth\] email code for (.+) type ([a-z-]+): ([0-9]{6})$` and `type sign-in`.
- Fill the six boxes. The heading becomes `Welcome to opencv`, then the URL is `/apply`.
- Sign out: choose the sidebar link named `Settings`, open the `Account` link in the Settings sections nav, choose `Sign out`.

## Driving it with agent-browser

Preconditions: a green `doctor.sh <run>`; `export AGENT_BROWSER_SESSION=verify-<run>`; `set -a; . ~/tmp/opencv-verify/<run>/run.env; set +a`; an email not used before in this run (`ada@verify.local`).

- **Sign in.** `agent-browser open "$WEB_URL/sign-in"`. The heading is `Log in to opencv`. There is no Password field. `agent-browser find role textbox fill "ada@verify.local" --name "Email"`, `agent-browser find role button click --name "Continue"`. Read the last matching line from `$EVIDENCE_DIR/api.log`. Fill the six boxes by typing or by pasting the six digits into Digit 1. `agent-browser wait --text "Welcome to opencv"`. Save `agent-browser screenshot "$EVIDENCE_DIR/signup.png"`. Then `agent-browser wait --url "**/apply"`. The account name is empty. Do not wait for a person's name.
- **Read the session.** `agent-browser eval "fetch('$API_URL/api/session',{credentials:'include'}).then(r=>r.text())"` returns `{"ok":true,"user":{...},"session":{...}}` with the email.
- **Guard.** After Log out, `agent-browser open "$WEB_URL/apply"` ends on a URL starting `/sign-in?redirect=`.
- **Sign out.** `agent-browser find role link click --name "Settings"`, `agent-browser find role link click --name "Account"`, `agent-browser find role button click --name "Sign out"`. The URL becomes `/sign-in`.
- **Wrong code.** On `/sign-in` choose `Continue` for the same email, then enter `000000`. The alert is `That code is incorrect or expired.` and the URL stays on `/sign-in`.
- **Sign in again.** Request a new code, fill it, and `agent-browser wait --url "**/apply"`. Welcome does not show. Save `agent-browser screenshot "$EVIDENCE_DIR/signin.png"`.
- **Language.** On the code step, choose `VI`. The heading stays English. After sign-in, `GET /api/profile` has `"language":"vi"`.
- **390.** Set the viewport to 390 wide. The hero line `Write your CV with a coach.` is not visible. The form is. Save `agent-browser screenshot "$EVIDENCE_DIR/signin-390.png"`.
- **Proof.** `signup.png` shows Welcome. `signin.png` shows the start page after the second sign-in. The session read returns `"ok":true` after each sign-in. The wrong-code step left the URL on `/sign-in`.
- **Session expired.** Not driven in the browser. The unit test covers Continue as, Email me a code, and Log out.

## Gotchas

- The code is in `api.log`, one line per send. Parse `type sign-in` and the six digits. Do not reuse `PROBE_EMAIL` from `run.env`.
- Welcome replaces the app until it finishes. Wait for the Welcome heading, then for `/apply`.
- A second sign-in of the same address skips Welcome.
- Wait for the Settings tabs to render before choosing `Account`. Without the wait the tab lookup fails with `No element found`.
- Locators match by accessible name as a case-insensitive substring. Keep the quoted names exact, and use `--exact` when two controls share a prefix.
- Sessions are cookie-bound to the api origin. A relaunch with a new `SESSION_SECRET` invalidates old cookies, so sign in again after any relaunch, even with `KEEP_DATA=1`.
- The fourth code send inside a minute returns 429. One wrong code is enough for the error step. Do not burn the rate limit.
