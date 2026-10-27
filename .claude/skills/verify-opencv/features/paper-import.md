# Paper file import

Paper (`/app/paper`) can bring in a PDF or Word file. A file opencv cannot read stays on the library with a reason. A file it can read opens as a block CV with a check bar.

## Sub-features

- `paper-import-progress` shows Importing… and Cancel while the upload runs.
- `paper-import-open` opens the new CV named after the file, without the extension.
- `paper-import-checks` shows Imported from {file}, a count to check, Phone missing, Add phone, and Skip.
- `paper-import-skip` removes a check, and a reload keeps it gone.
- `paper-import-pages` refuses a Pages file with Choose another file.
- `paper-import-link` refuses a pasted LinkedIn link without sending it.

## How to get to it (user POV)

- Choose `Paper` in the sidebar, or open `/app/paper`.
- On an empty account the import card is under Start a document.

## Driving it with agent-browser

Preconditions: signed in on a new account (see `auth.md`). A one-page text PDF is already at `~/tmp/opencv-verify/379/sample.pdf`.

- **Choose file.** `agent-browser open "$WEB_URL/app/paper"`. The heading `Start a document` is visible. Set the hidden file input to `sample.pdf` (the button is `Choose file`). The dialog shows `Importing…` and `Cancel`.
- **Open.** Wait until the URL matches `/app/paper/` plus an id. The document title is `sample`. The bar reads `Imported from sample.pdf` and `1 to check` when the phone is missing. `Phone missing`, `Add phone`, and `Skip` are visible.
- **Skip.** Choose `Skip`. The phone row is gone. `agent-browser reload`. The phone row stays gone.
- **Pages.** Go back to `/app/paper`. Choose a file named `resume.pages`. The dialog title is `Can't read this file`. The sentence is `Pages files aren't supported. Try a PDF or Word file.` The glow button is `Choose another file`.
- **Link.** On the empty library, fill `Paste a link` with `https://www.linkedin.com/in/example` and press Enter. The sentence is `LinkedIn links aren't supported. Download a PDF or Word file.` No request leaves the browser for that link.
- **Proof.** Save `agent-browser screenshot "$EVIDENCE_DIR/paper-import-checks.png"` of the check bar and `agent-browser screenshot "$EVIDENCE_DIR/paper-import-pages.png"` of the can't-read dialog.

## Gotchas

- Cancel on Importing… leaves the library and does not open a document.
- Google Doc links use the Google sentence and are not fetched.
- Add phone focuses the phone field. Filling it and waiting for Edited just now clears that check.
- Letters stay markdown. This recipe does not open a letter.
