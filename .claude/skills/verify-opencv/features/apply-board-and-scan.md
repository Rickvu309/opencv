# Apply board and URL scan

Apply (`/app/apply`) is a board with columns Inbox, Prep, Sent, Live and Closed. A card can move between columns, and the `Add job` dialog can scan a posting URL to fill title and company. In verification the posting fetch is a stub, so no network is used.

## Sub-features

- `apply-board` shows the four starter cards in their columns.
- `apply-move` drags a card to another column and keeps it there after reload.
- `apply-scan` fills title and company from a posting URL.
- `apply-add` adds the scanned card to Inbox.

## How to get to it (user POV)

- Choose `Apply` in the sidebar.
- Drag a card onto another column's cards; choose `Add job` to open the dialog.

## Driving it with agent-browser

Preconditions: signed in on a new account (see `auth.md`).

- **Board.** `agent-browser open "$WEB_URL/app/apply"` and `agent-browser get text main`. Inbox holds `Associate PM intern`, Prep `Business analyst intern`, Sent `Product analyst intern`, Closed `UX research intern`, Live is empty.
- **Move.** `agent-browser snapshot -i`, then `agent-browser drag @<Associate PM card> @<Business analyst card>` (drop on a card in the target column). Wait 2 s. `get text main` shows Inbox `0` and Prep `2`.
- **Persist.** `agent-browser reload` and `get text main` again: Prep still holds both cards.
- **Scan.** `agent-browser find role button click --name "Add job"`, `agent-browser find role textbox fill "https://careers.verify-posting.dev/associate-pm-intern" --name "Job posting URL"`, `agent-browser find role button click --name "Scan"`. Wait 3 s. The dialog text reads `Filled Associate Product Manager Intern at Northwind Labs.`
- **Add.** Choose the dialog's `Add job` button (the last `Add job` button in `snapshot -i`). Inbox now holds a card titled `Associate Product Manager Intern` with company `Northwind Labs`.
- **Proof.** `agent-browser screenshot "$EVIDENCE_DIR/apply-move-scan.png"` after the add, plus the pre- and post-move `get text main` output saved beside it.

## Gotchas

- Do not use `https://jobs.example.com/...`. That host is the demo seed host and the product rejects it with `That posting link isn't a valid web URL.`
- The stub ignores the URL and always returns the same posting: `Northwind Labs is hiring an Associate Product Manager Intern in Hanoi.` Any other valid non-demo URL gives the same fields.
- A drop onto an empty column (`Drop a job here`) was not driven. Drop onto a card.
- Each scan plus `Add job` creates one more card. Repeat runs on the same account accumulate cards.
- Calendar view, search and the card detail panel were not driven.
