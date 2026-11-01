# Shell

The signed-in shell wraps every page except Settings. Signed in, `/` redirects to the start page from the profile. The legacy `/app` prefix redirects to the same route without it. Apply is the default.

## Sub-features

- `sidebar` shows the mark and the opencv wordmark, Search, New chat, Inbox, Coach, Jobs, Your work (Paper, Apply, Pitch), Favorites when any exist, and a footer with the name and Settings.
- `dock` shows up to two recent chat chips, then Coach, then History.
- `panel` opens over the page with Minimize, Expand and Close. Escape closes it and returns focus.
- `drawer` below 768 replaces the sidebar. Menu opens it. Choosing a link closes it. The dock stays.

## How to get to it (user POV)

- Sign up or sign in (see `auth.md`). The app lands on `/apply`.
- Settings (`/settings`) has no sidebar and no dock.

## Driving it with agent-browser

Preconditions: signed in; `run.env` loaded; session `verify-374`.

- **Start page.** `agent-browser open "$WEB_URL/"`. The URL is `/apply`. The page has a heading Apply.
- **Sidebar at 1440.** `agent-browser set viewport 1440 900`. Snapshot shows links Inbox, Coach, Jobs, Paper, Apply, Pitch, in that order, plus Search and New chat. The wordmark reads opencv.
- **Dock.** Snapshot shows Coach and History. With no chats, there is no chip.
- **Panel on Paper.** Open `/paper`. Click the dock button Coach. The panel shows Minimize, Expand and Close. Click Minimize, then open Coach again, click Expand, then Close.
- **Escape.** Open Coach, press Escape. The panel closes and focus returns to the Coach button.
- **Panel on Apply.** Open `/apply`, click dock Coach, and confirm Close is present. Close it.
- **New chat.** Click New chat. A later `GET /api/chats` includes the created row. `agent-browser eval "fetch('$API_URL/api/chats',{credentials:'include'}).then(r=>r.text())"`.
- **Drawer at 390.** `agent-browser set viewport 390 844`. The Inbox link is absent until Menu. Click Menu. Click Apply. The dialog closes and the URL stays on Apply. The dock is still there. The page does not scroll sideways.
- **Reduced motion.** `agent-browser set media reduced-motion reduce`, reload, and confirm the sidebar and dock still render.
- **Proof.** Screenshots `$EVIDENCE_DIR/shell-1440-sidebar.png`, `shell-1440-dock.png`, `shell-1440-panel-paper.png`, `shell-1440-panel-apply.png`, `shell-390-top.png`, `shell-390-drawer.png`, `shell-390-dock.png`, `shell-reduced.png`.

## Gotchas

- The panel body is the existing thread view until #377. Send stays the secondary button.
- Favorites link to their own job (`/apply/$jobId`) and document (`/paper/$docId`).
- Inbox shows a count only when the payload items include `unread`.
- The retired Home page has no route. Its old paths show the calm 404 with Back to start.
