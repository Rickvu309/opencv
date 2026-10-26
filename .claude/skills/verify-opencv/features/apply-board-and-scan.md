# Apply board and URL scan

Apply (`/app/apply`) is a board with columns Inbox, Prep, Sent, Live and Closed. A new account has no cards. The `Add opportunity` dialog scans a posting URL to fill title and company. In verification the posting fetch is a stub, so no network is used.

## Sub-features

- `apply-board` shows the empty columns before the first card.
- `apply-scan` fills title and company from a posting URL.
- `apply-add` adds the scanned card to Inbox.
- `apply-move` moves that card to Prep and keeps it there after reload.

## How to get to it (user POV)

- Choose `Apply` in the sidebar.
- Choose `Add opportunity`, scan a posting, then add the card.
- Open the card and choose `Prep` in the stage menu.

## Driving it with agent-browser

Preconditions: signed in on a new account (see `auth.md`). The board has no cards.

- **Board.** `agent-browser open "$WEB_URL/app/apply"` and `agent-browser get text main`. The columns Inbox, Prep, Sent, Live and Closed are on the page, and no card title is present.
- **Scan.** `agent-browser find role button click --name "Add opportunity"`, `agent-browser find role textbox fill "https://careers.verify-posting.dev/associate-pm-intern" --name "Posting link"`, `agent-browser find role button click --name "Scan"`. Wait 3 s. The dialog text reads `Filled Associate Product Manager Intern at Northwind Labs.`
- **Add.** Choose the dialog's `Add opportunity` button (the last `Add opportunity` button in `snapshot -i`). Inbox holds a card titled `Associate Product Manager Intern` with company `Northwind Labs`.
- **Move.** Open that card. `agent-browser find role button click --name "Stage: Inbox"`, then `agent-browser find role menuitem click --name "Prep"`. Wait 2 s. The stage button reads `Stage: Prep`.
- **Persist.** `agent-browser reload`, open the card again, and confirm the stage button still reads `Stage: Prep`.
- **Proof.** `agent-browser screenshot "$EVIDENCE_DIR/apply-move-scan.png"` after the move, plus the api read of `GET /api/apply` showing the card.

## Gotchas

- Do not use `https://jobs.example.com/...`. That host is rejected with `That posting link isn't a valid web URL.`
- The stub ignores the URL and always returns the same posting: `Northwind Labs is hiring an Associate Product Manager Intern in Hanoi.` A second add with the same URL is a duplicate and is refused.
- Dragging onto an empty column was not driven. The move uses the stage menu because the new card is the only card.
- Calendar view and search were not driven.
