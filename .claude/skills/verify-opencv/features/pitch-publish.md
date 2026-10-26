# Pitch placeholder

Pitch (`/app/pitch`) is a placeholder on the app shell. The sidebar item still opens it. Publishing and `/u/<slug>` are gone.

## Sub-features

- `pitch-placeholder` shows the heading `Pitch. Coming soon.`
- `pitch-public-gone` has no `/u/<slug>` route.

## How to get to it (user POV)

- Choose `Pitch` in the sidebar.

## Driving it with agent-browser

Preconditions: signed in on a new account (see `auth.md`).

- **Open.** `agent-browser open "$WEB_URL/app/pitch"`. The heading reads `Pitch. Coming soon.`
- **Public route.** `agent-browser open "$WEB_URL/u/ada-verify"` does not render a Pitch. The app has no `/u/$slug` route.
- **Proof.** `agent-browser screenshot "$EVIDENCE_DIR/pitch-placeholder.png"`.

## Gotchas

- There is no Edit, Publish, or Copy link control on this page.
- There is no Pitch API to read back.
