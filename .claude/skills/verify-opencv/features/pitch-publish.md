# Pitch publish

Pitch (`/app/pitch`) is the user's public one-page profile. `Edit profile` then `Publish` makes it public at `/u/<slug>`, where a signed-out visitor can read it.

## Sub-features

- `pitch-edit` enters edit mode with `Edit profile`.
- `pitch-publish` publishes and enables `Copy link`.
- `pitch-public` serves `/u/<slug>` and `GET /api/pitch/public/<slug>` to a signed-out visitor.
- `pitch-unknown` answers 404 for an unknown slug.

## How to get to it (user POV)

- Choose `Pitch` in the sidebar, then `Edit profile`, then `Publish`.
- Share the link from `Copy link`; visitors open `/u/<slug>`.

## Driving it with agent-browser

Preconditions: signed in as `Ada Verify` on a new account (see `auth.md`). The slug is the slugified display name, `ada-verify`.

- **Before.** `agent-browser open "$WEB_URL/app/pitch"`. The `Copy link` button is disabled and `curl -s -o /dev/null -w '%{http_code}' "$API_URL/api/pitch/public/ada-verify"` prints `404`.
- **Edit.** `agent-browser find role button click --name "Edit profile"`. A `Publish` button and a `Done` button appear.
- **Publish.** `agent-browser find role button click --name "Publish"`. Wait 2 s. `Copy link` is now enabled. `agent-browser eval "fetch('$API_URL/api/pitch',{credentials:'include'}).then(r=>r.json()).then(j=>j.data.content.published)"` prints `true`.
- **Public read.** `curl -s -o /dev/null -w '%{http_code}' "$API_URL/api/pitch/public/ada-verify"` prints `200`.
- **Signed out.** Use a second session: `AGENT_BROWSER_SESSION=verify-<run>-anon agent-browser open "$WEB_URL/u/ada-verify"`. The page shows the heading `Ada Verify`. Save `AGENT_BROWSER_SESSION=verify-<run>-anon agent-browser screenshot "$EVIDENCE_DIR/pitch-public.png"`, then close that session.
- **Unknown slug.** `curl -s -o /dev/null -w '%{http_code}' "$API_URL/api/pitch/public/nobody-here"` prints `404`.
- **Proof.** `pitch-public.png` plus the 404, 200, 404 status sequence.

## Gotchas

- The sample Pitch shows `Clear demo` buttons and sample copy. Publishing works without clearing the demo, and the public page carries the sample copy.
- `GET /api/pitch` does not return the slug. Derive it from the display name, or read it from the share link text on the page.
- `Copy link` writes to the clipboard and shows `Copied`; headless runs cannot paste it back, so do not rely on it for the URL.
- Unpublishing, `Add section`, highlights and Open Proof were not driven. `Add card` and `New highlight` are disabled placeholders.
