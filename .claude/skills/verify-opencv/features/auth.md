# Auth

Auth lets a visitor create an account, sign out, and sign in again. Sign-up writes profile defaults only. Home has no sample CV, no Apply cards, and no welcome thread.

## Sub-features

- `auth-signup` creates an account and lands on `/app`.
- `auth-guard` redirects a signed-out visit to `/app` to `/sign-in`.
- `auth-signout` ends the session from Settings.
- `auth-signin` signs back in and lands on `/app`.
- `auth-wrong-password` shows an inline error and stays on `/sign-in`.

## How to get to it (user POV)

- Open `/sign-up`, fill Name, Email and Password, choose `Create account`.
- Open `/sign-in`, fill Email and Password, choose `Sign in`.
- Sign out: choose the sidebar link named `<Name>, profile and settings`, open the `Account` tab, choose `Sign out`.

## Driving it with agent-browser

Preconditions: a green `doctor.sh <run>`; `export AGENT_BROWSER_SESSION=verify-<run>`; `set -a; . ~/tmp/opencv-verify/<run>/run.env; set +a`; an email not used before in this run (for example `ada@verify.local`).

- **Sign up.** `agent-browser open "$WEB_URL/sign-up"`, then `agent-browser find role textbox fill "Ada Verify" --name "Name"`, `agent-browser find role textbox fill "ada@verify.local" --name "Email"`, `agent-browser find role textbox fill "Verify-pass-123" --name "Password"`, `agent-browser find role button click --name "Create account"`. Then `agent-browser wait --url "**/app"` and `agent-browser wait --text "Ada Verify"`. The page heading reads `Good <daypart>, Ada Verify`. Save `agent-browser screenshot "$EVIDENCE_DIR/signup.png"`.
- **Read the session.** `agent-browser eval "fetch('$API_URL/api/session',{credentials:'include'}).then(r=>r.text())"` returns `{"ok":true,"user":{...},"session":{...}}` with the email.
- **Guard.** After signing out, `agent-browser open "$WEB_URL/app"` ends on a URL starting `/sign-in?redirect=`.
- **Sign out.** `agent-browser find role link click --name "profile and settings"`, `agent-browser wait --text "Connected apps"`, `agent-browser find role tab click --name "Account"`, `agent-browser find role button click --name "Sign out"`. The URL becomes `/sign-in`.
- **Wrong password.** On `/sign-in` fill Email and a wrong Password, choose `Sign in`. An alert reads `Invalid email or password` and the URL stays `/sign-in`.
- **Sign in.** Fill the right Password and choose `Sign in`. `agent-browser wait --url "**/app"` and `agent-browser wait --text "Ada Verify"`. Save `agent-browser screenshot "$EVIDENCE_DIR/signin.png"`.
- **Proof.** `signup.png` and `signin.png` both show the Home heading, the session read returns `"ok":true` after each, and the wrong-password step left the URL on `/sign-in`.

## Gotchas

- The URL changes to `/app` before the session loads, and the heading first reads `Good evening, there`. Wait for the user name before reading the heading or taking a screenshot.
- Wait for the Settings tabs to render before choosing `Account`. Without the wait the tab lookup fails with `No element found`.
- Locators match by accessible name as a case-insensitive substring. Keep the quoted names exact, and use `--exact` when two controls share a prefix.
- The launch script already signed up a `launch-probe-...@verify.local` user (in `run.env` as `PROBE_EMAIL`). Do not reuse that address for the drive.
- Sessions are cookie-bound to the api origin. A relaunch with a new `SESSION_SECRET` invalidates old cookies, so sign in again after any relaunch, even with `KEEP_DATA=1`.
- Auth rate limiting uses one shared bucket (the api logs a warning about the client IP). Many wrong passwords in a row can throttle later steps.
