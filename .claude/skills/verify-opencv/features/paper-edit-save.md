# Paper edit and save

Paper (`/app/paper`) is a library. A new account sees Start a document. Creating a CV from the Simple template opens an editor at `/app/paper/{id}` that saves on change. The edit survives a reload of that URL.

## Sub-features

- `paper-library` shows Start a document on an empty account.
- `paper-create` chooses CV, then Simple, then Use template, and lands on `/app/paper/{id}`.
- `paper-edit` sets the summary field to `Edited for verify.`
- `paper-save` shows Edited just now with no extra click.
- `paper-persist` keeps that sentence after a reload and in `GET /api/paper/{id}`.
- `paper-letter` starts a blank letter for a job and keeps a typed line after a reload.

## How to get to it (user POV)

- Choose `Paper` in the sidebar, or open `/app/paper`.
- Choose `CV`, then `Simple`, then `Use template`.

## Driving it with agent-browser

Preconditions: signed in on a new account (see `auth.md`). The library shows Start a document.

- **Library.** `agent-browser open "$WEB_URL/app/paper"`. The heading `Start a document` is visible. Save `agent-browser screenshot "$EVIDENCE_DIR/paper-library-empty.png"`.
- **Create.** `agent-browser find role button click --name "CV"`. `agent-browser find role button click --name "Simple"`. `agent-browser find role button click --name "Use template"`. Wait until the URL matches `/app/paper/` plus an id. The region name starts with `Editing`.
- **Edit.** `agent-browser find role textbox fill "Edited for verify." --name "Summary"`.
- **Wait for the save.** Wait until the text `Edited just now` is visible. That is the save. There is no Save button.
- **Reload.** `agent-browser reload`. The summary field still reads `Edited for verify.`
- **Read back.** `agent-browser eval "fetch('$API_URL/api/paper/' + location.pathname.split('/').pop(),{credentials:'include'}).then(r=>r.text())"` contains `Edited for verify.`
- **Proof.** `agent-browser screenshot "$EVIDENCE_DIR/paper-edit-saved.png"` of the reloaded editor, plus the api read above.
- **Letter.** Create a job with `POST /api/commands/job.create` and body `{"title":"Associate PM","company":"Northwind"}`. Open `/app/paper`, choose `Cover letter`, choose the button `Associate PM, Northwind`, choose `Start blank`. The URL is `/app/paper/{id}`. Fill the letter textbox with `One line for verify.` Wait 2 s. Reload. The line is still there. Save `agent-browser screenshot "$EVIDENCE_DIR/paper-letter-saved.png"`.
- **Letter caret.** Click the letter textbox, put the caret inside a word, and type one letter. Wait 2 s. The new letter stays inside that word and the caret stays just after it. Save `agent-browser screenshot "$EVIDENCE_DIR/paper-letter-caret.png"`.
- **Letter leave.** Type a word and choose `Paper` within 300 ms. Choose the cover letter card. The word is in the letter. Save `agent-browser screenshot "$EVIDENCE_DIR/paper-letter-left.png"`.
- **Letter reload.** Type another word and reload within 300 ms. The word is still in the letter and in `GET /api/paper/{id}`. Save `agent-browser screenshot "$EVIDENCE_DIR/paper-letter-reloaded.png"`.

## Gotchas

- The editor is URL-addressed. Reload the doc URL. Do not expect a documents table.
- The name field on the page is `Name`. Do not look for `Your name`.
- The summary field's accessible name is `Summary`.
- Fit to one page is not part of this recipe. The scripted Coach may not return a `paper.replace` tool result. Report that step as not driven when a later pass tries it.
- The card menu, search with no match, Copy link, and the suggestion card are not part of this recipe.
