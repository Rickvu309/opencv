# Paper edit and save

Paper (`/app/paper`) lists documents. Opening the starter CV shows an editor that saves on change. The edit survives a reload.

## Sub-features

- `paper-list` shows the starter `Sample internship CV` row.
- `paper-edit` changes a bullet in the open CV.
- `paper-save` reaches the `Saved` state with no click.
- `paper-persist` shows the edit after a reload and in `GET /api/paper`.

## How to get to it (user POV)

- Choose `Paper` in the sidebar, then a row in the documents table.
- From Home, choose `Open the sample CV` in the `Four small things` checklist.

## Driving it with agent-browser

Preconditions: signed in on a new account (see `auth.md`).

- **Open.** `agent-browser open "$WEB_URL/app/paper"`, then `agent-browser find text "Sample internship CV" click --exact`. A region named `Editing Sample internship CV` appears. The URL stays `/app/paper`.
- **Edit.** The bullet is a contenteditable element, and `fill` prepends instead of replacing. Take `agent-browser snapshot -i`, note the ref of the first `Bullet point` textbox, then `agent-browser click @<ref>`, `agent-browser press Control+a`, `agent-browser press Backspace`, and `agent-browser type @<ref> "Ran weekly problem interviews with 8 classmates; edited for verify."`. The snapshot then shows exactly that text in the bullet.
- **Wait for the save.** The button named `Saved` is disabled again after the edit. Wait 3 s and re-check with `agent-browser snapshot -i`.
- **Reload.** `agent-browser reload`. The page returns to the documents table, now with a row named `<Name>'s CV` (for example `Ada's CV`).
- **Read back.** `agent-browser eval "fetch('$API_URL/api/paper',{credentials:'include'}).then(r=>r.text())"` contains `edited for verify`.
- **Reopen.** `agent-browser find text "Ada's CV" click --exact`. The first bullet reads the edited text.
- **Proof.** `agent-browser screenshot "$EVIDENCE_DIR/paper-edit-saved.png"` of the reopened editor, plus the api read above.

## Gotchas

- The editor is not URL-addressed. A reload goes back to the table, so reopen the row to see the text.
- The first edit to the sample CV turns it into the user's own document and renames it to `<Name>'s CV`. The select-all, delete and type sequence still leaves only the new text in the bullet.
- Never use `fill` on a bullet: it prepends the new text to the old text, and repeating it accumulates.
- Table rows are named by their cell text in `snapshot -i` (for example `row "SASample internship CV..."`), but `find role row --name "Sample internship CV"` does not match them. Click the row by its `@ref` from the snapshot, or by visible text with `find text "<name>" click --exact`.
- Bullet textboxes all share the name `Bullet point`. Pick by order in the snapshot.
- Filter, the file chooser and Share are not part of this recipe and were not driven.
