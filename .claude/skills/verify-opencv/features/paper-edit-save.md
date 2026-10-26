# Paper edit and save

Paper (`/app/paper`) lists documents. A new account has none. Creating a CV opens an editor that saves on change. The edit survives a reload.

## Sub-features

- `paper-create` adds a CV named `Untitled CV`.
- `paper-edit` sets the name field.
- `paper-save` reaches the `Saved` state with no extra click.
- `paper-persist` shows the edit after a reload and in `GET /api/paper`.

## How to get to it (user POV)

- Choose `Paper` in the sidebar.
- Choose `New`, then `CV`.

## Driving it with agent-browser

Preconditions: signed in on a new account (see `auth.md`). The documents table is empty.

- **Create.** `agent-browser open "$WEB_URL/app/paper"`. `agent-browser find role button click --name "New"`, then `agent-browser find role menuitem click --name "CV"`. A region named `Editing Untitled CV` appears. The URL stays `/app/paper`.
- **Edit.** `agent-browser find role textbox fill "Ada Verify" --name "Your name"`.
- **Wait for the save.** The button named `Saved` is disabled again after the edit. Wait 3 s and re-check with `agent-browser snapshot -i`.
- **Reload.** `agent-browser reload`. The page returns to the documents table with a row `Untitled CV`.
- **Read back.** `agent-browser eval "fetch('$API_URL/api/paper',{credentials:'include'}).then(r=>r.text())"` contains `Ada Verify`.
- **Reopen.** `agent-browser find text "Untitled CV" click --exact`. The name field reads `Ada Verify`.
- **Proof.** `agent-browser screenshot "$EVIDENCE_DIR/paper-edit-saved.png"` of the reopened editor, plus the api read above.

## Gotchas

- The editor is not URL-addressed. A reload goes back to the table, so reopen the row to see the text.
- The name field's accessible name stays `Your name` when it is empty. After the fill, the value is `Ada Verify`.
- Table rows are named by their cell text in `snapshot -i`. `find role row` may not match them. Click the row by visible text with `find text "Untitled CV" click --exact`.
- Filter, the file chooser and Share are not part of this recipe and were not driven.
