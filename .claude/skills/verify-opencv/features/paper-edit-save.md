# Paper edit and save

Paper (`/paper`) is a library. A new account sees Start a document. Creating a CV from the Simple template opens an editor at `/paper/{id}` that saves on change. The edit survives a reload of that URL.

## Sub-features

- `paper-library` shows Start a document on an empty account.
- `paper-create` chooses CV, then Simple, then Use template, and lands on `/paper/{id}`.
- `paper-edit` sets Role, company to `Edited for verify.`
- `paper-save` shows Edited just now with no extra click.
- `paper-persist` keeps that sentence after a reload and in `GET /api/paper/{id}` as version 2.
- `paper-blocks` covers slash insert, the block menu, drag, Ask Coach, undo, share, a 390px window, reduced motion, and the keyboard path.
- `paper-letter` starts a blank letter for a job and keeps a typed line after a reload.

## How to get to it (user POV)

- Choose `Paper` in the sidebar, or open `/paper`.
- Choose `CV`, then `Simple`, then `Use template`.

## Driving it with agent-browser

Preconditions: signed in on a new account (see `auth.md`). The library shows Start a document.

- **Library.** `agent-browser open "$WEB_URL/paper"`. The heading `Start a document` is visible. Save `agent-browser screenshot "$EVIDENCE_DIR/paper-library-empty.png"`.
- **Create.** `agent-browser find role button click --name "CV"`. `agent-browser find role button click --name "Simple"`. `agent-browser find role button click --name "Use template"`. Wait until the URL matches `/paper/` plus an id. The region name starts with `Editing`.
- **Blank.** The editor shows textboxes named Email, Phone, City, LinkedIn, Role, company, Dates, What you did, and what changed because of it, School, degree, and Tools, software and languages. Each has an empty stored value. `GET /api/paper/{id}` has `"version":2`.
- **Edit.** `agent-browser find role textbox fill "Edited for verify." --name "Role, company"`. Typing on a CV field persists where fill does not. Prefer `agent-browser find role textbox click --name "Role, company"` and then `agent-browser keyboard type "Edited for verify."`.
- **Wait for the save.** Wait until the text `Edited just now` is visible. That is the save. There is no Save button.
- **Reload.** `agent-browser reload`. The role field still reads `Edited for verify.`
- **Read back.** `agent-browser eval "fetch('$API_URL/api/paper/' + location.pathname.split('/').pop(),{credentials:'include'}).then(r=>r.text())"` contains `Edited for verify.` and `"version":2`.
- **Slash.** Click the textbox What you did, and what changed because of it. Press `/`. A listbox named Insert opens, with Type to filter, CV sections, and Blocks. Press Escape. It closes.
- **Menu.** Focus a block and open the button Block menu. The menu has Turn into, Duplicate, Move up, Move down, Ask Coach, and Delete.
- **Drag.** Drag a block by its Block menu handle within a section, then onto another section heading. Reload. The order matches the drop.
- **Ask Coach.** Choose Ask Coach on a block. The dock Coach panel opens and the composer contains that block's text.
- **Undo.** Delete a block, then choose Undo. The block comes back.
- **Share.** Open the share URL. The CV text renders.
- **Narrow.** At 390px wide, `/` in an empty block opens the Insert list upward.
- **Reduced motion.** With prefers-reduced-motion, a dragged block sets no transform.
- **Keyboard.** Tab reaches one stop per block. Enter moves into the field. Escape returns to the block. Shortcuts Duplicate, Move up, Move down, and Delete run while the block is selected.
- **Proof.** `agent-browser screenshot "$EVIDENCE_DIR/paper-edit-saved.png"` of the reloaded editor, plus the api read above.
- **Letter.** Create a job with `POST /api/commands/job.create` and body `{"title":"Associate PM","company":"Northwind"}`. Open `/paper`, choose `Cover letter`, choose the button `Associate PM, Northwind`, choose `Start blank`. The URL is `/paper/{id}`. Fill the letter textbox with `One line for verify.` Wait 2 s. Reload. The line is still there. Save `agent-browser screenshot "$EVIDENCE_DIR/paper-letter-saved.png"`.
- **Letter caret.** Click the letter textbox, put the caret inside a word, and type one letter. Wait 2 s. The new letter stays inside that word and the caret stays just after it. Save `agent-browser screenshot "$EVIDENCE_DIR/paper-letter-caret.png"`.
- **Letter leave.** Type a word and choose `Paper` within 300 ms. Choose the cover letter card. The word is in the letter. Save `agent-browser screenshot "$EVIDENCE_DIR/paper-letter-left.png"`.
- **Letter reload.** Type another word and reload within 300 ms. The word is still in the letter and in `GET /api/paper/{id}`. Save `agent-browser screenshot "$EVIDENCE_DIR/paper-letter-reloaded.png"`.

## Gotchas

- The editor is URL-addressed. Reload the doc URL. Do not expect a documents table. `/app/paper` redirects to `/paper`.
- The name field on the page is `Name`. Do not look for `Your name`.
- A blank CV has no Summary field. The role placeholder is `Role, company`. A filled role is named `Role`.
- The document title in the breadcrumb is also named `Name`. The CV header name sits in the level 1 heading.
- Fit to one page is not part of this recipe. The scripted Coach may not return a `paper.replace` tool result. Report that step as not driven when a later pass tries it.
- The card menu, search with no match, Copy link, and the suggestion card are not part of this recipe.
