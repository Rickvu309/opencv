# Paper import

Paper (`/paper`) imports a PDF or Word file into a version 2 CV, shows Importing and Can't read as dialogs on the library, and shows a check bar on the editor. A pasted Google Doc or LinkedIn link is refused and stored as nothing.

## Sub-features

- `paper-import-pdf` turns a text PDF into blocks and opens the editor with `Imported from sample.pdf` and `1 to check`.
- `paper-import-phone` focuses Phone, types a number, waits for Edited just now, then Done. A reload keeps the bar gone.
- `paper-import-docx` turns a text DOCX into a block that contains the fixture sentence.
- `paper-import-pages` shows Can't read this file and the Pages sentence, and stores no row.
- `paper-import-links` shows the Google Docs sentence and the LinkedIn sentence, and stores nothing.
- `paper-import-cancel` leaves the library on Start a document.
- `paper-import-size` shows File must be 8 MB or smaller.
- `paper-import-narrow` screenshots the Can't read dialog at 390 width.

## How to get to it (user POV)

- Choose `Paper` in the sidebar, or open `/paper`.
- On an empty account the import row is the region named `Import a file`.

## Fixtures

Build them in the worktree. Do not commit the bytes.

```
cd "$ROOT"
mkdir -p "$EVIDENCE_DIR"
pnpm --filter api exec tsx -e "
import { writeFileSync } from 'node:fs'
import { textDocx, textPdf } from './src/paper/import-fixtures.test.ts'
writeFileSync(process.env.EVIDENCE_DIR + '/sample.pdf', textPdf('Campus newsletter'))
writeFileSync(process.env.EVIDENCE_DIR + '/notes.docx', textDocx('Weekly newsletter for students'))
writeFileSync(process.env.EVIDENCE_DIR + '/sample.pages', Buffer.from('not a pages file'))
writeFileSync(process.env.EVIDENCE_DIR + '/big.pdf', Buffer.alloc(9_000_000))
"
```

`ROOT` is the worktree. `EVIDENCE_DIR` comes from `run.env`.

## Driving it with agent-browser

Preconditions: signed in on a new account (see `auth.md`). The library shows Start a document. Own `agent-browser` session. Do not copy a sign-in code into the report.

- **PDF.** `agent-browser open "$WEB_URL/paper"`. Set the hidden file input to `$EVIDENCE_DIR/sample.pdf` (the row button is `Choose file`). Wait until the URL matches `/paper/` plus an id. The region name starts with `Editing`. A block contains `Campus newsletter`. The region `Import checks` shows `Imported from sample.pdf` and `1 to check`. Save `agent-browser screenshot "$EVIDENCE_DIR/paper-import-pdf.png"`.
- **Phone.** `agent-browser find role button click --name "Add phone"`. The textbox named `Phone` is focused. `agent-browser keyboard type "555 0100"`. Wait until `Edited just now` is visible and `Phone missing` is gone. `Done` is visible. Choose `Done`. Wait until `GET /api/paper/{id}` checks is `[]`. `agent-browser reload`. The region `Import checks` stays gone. Save `agent-browser screenshot "$EVIDENCE_DIR/paper-import-done.png"`.
- **DOCX.** Open `/paper`. Import `$EVIDENCE_DIR/notes.docx`. The editor contains `Weekly newsletter for students`. Save `agent-browser screenshot "$EVIDENCE_DIR/paper-import-docx.png"`.
- **Pages.** Open `/paper`. Import `$EVIDENCE_DIR/sample.pages`. The dialog heading is `Can't read this file`. The alert contains `Pages files aren't supported. Try a PDF or Word file.` `GET /api/paper` has no document named `sample`. Save `agent-browser screenshot "$EVIDENCE_DIR/paper-import-pages.png"`.
- **Links.** On the empty library, focus the textbox `Paste a link`, type `https://docs.google.com/document/d/abc`, and press Enter. The alert contains `Google Docs aren't supported. Download a PDF or Word file.` Close the dialog. Paste `https://www.linkedin.com/in/example` the same way. The alert contains `LinkedIn links aren't supported. Download a PDF or Word file.` `GET /api/paper` and `GET /api/paper/files` gain no row. Save `agent-browser screenshot "$EVIDENCE_DIR/paper-import-link.png"`.
- **Cancel.** Open `/paper` on an account whose library is still Start a document, or after closing the error dialog. Start an import of a 7 MB PDF and choose `Cancel` once the heading `Importing…` is visible. Wait until that import request has finished, then until the follow-up deletes have finished. The library still shows `Start a document`, the URL stays `/paper`, and `GET /api/paper` and `GET /api/paper/files` are empty. Cancel leaves the upload running so the response can be discarded. An early click that never reaches the server is not this check.
- **Empty type.** Build `empty-type.pdf` with the same bytes as `sample.pdf`. On the empty library, put that file on the hidden input as a `File` whose `type` is `""` and dispatch `change`. The editor opens and a block contains `Campus newsletter`. A `.pdf` name alone makes the browser send `application/pdf`, so the empty type has to be set on the `File`.
- **Size.** Import `$EVIDENCE_DIR/big.pdf`. The alert contains `File must be 8 MB or smaller.` Save `agent-browser screenshot "$EVIDENCE_DIR/paper-import-size.png"`.
- **Narrow.** With the Can't read dialog open, `agent-browser set viewport 390 844`. Save `agent-browser screenshot "$EVIDENCE_DIR/paper-import-390.png"`.
- **Keyboard.** Tab reaches `Paste a link` and `Choose file`. Inside the dialog, Tab reaches `Cancel` or `Start blank` and `Choose another file`. Each control has its accessible name.
- **Reduced motion.** `agent-browser set media prefers-reduced-motion reduce`, then open Importing. The spinner has no animation. Save `agent-browser screenshot "$EVIDENCE_DIR/paper-import-reduced.png"`.
- **Read back.** `agent-browser eval "fetch('$API_URL/api/paper/' + location.pathname.split('/').pop(),{credentials:'include'}).then(r=>r.text())"` for the PDF doc contains `Campus newsletter` and `"version":2`.

## Gotchas

- The file input is visually hidden. Set its files. Do not look for a second Choose file on the error dialog until the dialog is open. That button is `Choose another file`.
- Typing on the phone field persists where fill does not.
- `/app/paper` redirects to `/paper`.
- A text PDF with no phone and no experience entry shows one check, the phone check.
- Do not copy the sign-in code from `api.log`.
