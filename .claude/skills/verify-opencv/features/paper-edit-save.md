# Paper edit and save

Paper (`/paper`) is a library. A new account sees Start a document. Creating a CV from the Simple template opens an editor at `/paper/{id}` that saves on change. The edit survives a reload of that URL.

## Sub-features

- `paper-library` shows Start a document on an empty account.
- `paper-create` chooses CV, then Simple, then Use template, and lands on `/paper/{id}`.
- `paper-edit` sets Role, company to `Edited for verify.`
- `paper-save` shows Edited just now with no extra click.
- `paper-persist` keeps that sentence after a reload and in `GET /api/paper/{id}` as the v3 paper.
- `paper-blocks` covers slash insert, the block menu, drag, a drop on a section heading, Ask Coach, undo, share, a 390px window, reduced motion, and the keyboard path.
- `paper-letter` starts a blank letter for a job and keeps a typed line after a reload.

## How to get to it (user POV)

- Choose `Paper` in the sidebar, or open `/paper`.
- Choose `CV`, then `Simple`, then `Use template`.

## Driving it with agent-browser

Preconditions: signed in on a new account (see `auth.md`). The library shows Start a document.

- **Library.** `agent-browser open "$WEB_URL/paper"`. The heading `Start a document` is visible. Save `agent-browser screenshot "$EVIDENCE_DIR/paper-library-empty.png"`.
- **Create.** `agent-browser find role button click --name "CV"`. `agent-browser find role button click --name "Simple"`. `agent-browser find role button click --name "Use template"`. Wait until the URL matches `/paper/` plus an id. The region name starts with `Editing`.
- **Blank.** The editor opens with the textbox `CV Untitled CV` and the level 1 heading `Full name`. A fresh Simple template lists textboxes named Full name, Email, Phone, City, LinkedIn, Role, Dates, School, Years and Skills. Company, Location and the bullet textbox appear inside an entry once Role has text. `GET /api/paper/{id}` has `"version":3`.
- **Edit.** `agent-browser find role textbox click --name "Role"` and then `agent-browser keyboard type "Edited for verify."`. Typing on a CV field persists where fill does not. The Role placeholder stays `Role, company`.
- **Wait for the save.** Wait until the text `Edited just now` is visible. That is the save. There is no Save button.
- **Reload.** `agent-browser reload`. The role field still reads `Edited for verify.`
- **Read back.** `agent-browser eval "fetch('$API_URL/api/paper/' + location.pathname.split('/').pop(),{credentials:'include'}).then(r=>r.text())"` contains `Edited for verify.` and `"version":3`.
- **Slash.** Click the textbox What you did, and what changed because of it. Press `/`. A listbox named Insert opens, with Type to filter, CV sections, and Blocks. Press Escape. It closes.
- **Menu.** Focus a block and open the button Block menu. The menu has Turn into, Duplicate, Move up, Move down, Ask Coach, and Delete.
- **Drag.** Drag a block by its Block menu handle within a section, then onto another section heading. Reload. The order matches the drop.
- **Drop on a heading.** With two experience entries, one education entry, and one skills group, drag the second experience entry onto the Education heading. Reload. That education entry is still there and the dragged entry is after it. Drag that entry onto the Skills heading. Reload. The skills group is still there and the dragged entry is after it. `GET /api/paper/{id}` matches both reloads. Save `agent-browser screenshot "$EVIDENCE_DIR/paper-drop-education.png"` and `paper-drop-skills.png`.
- **Heading hit area.** Make ten consecutive heading drops across Education, Skills, Projects, and Activities. Record the pointer-up coordinates and heading rect for each drop. Include the heading's top, middle, and bottom edges. Every drop appends after the section's existing blocks and sends one `paper.sync`. Reload and compare `GET /api/paper/{id}`. A drop just below the heading onto the first block still inserts before that block. Save the action log and screenshots under the run evidence directory.
- **Ask Coach.** Choose Ask Coach on a block. The dock Coach panel opens and the composer contains that block's text.
- **Undo.** Delete a block, then choose Undo. The block comes back.
- **Share.** Open the share URL. The CV text renders.
- **Narrow.** At 390px wide, `/` in an empty block opens the Insert list upward.
- **Reduced motion.** With prefers-reduced-motion, a dragged block sets no transform.
- **Keyboard.** Tab from the Name field inside the level 1 heading reaches Email, Phone, City, LinkedIn, then one stop per block. The empty experience block is named `Role, company`. Enter moves into Role. Tab reaches Company, Dates, then the bullet What you did, and what changed because of it, then Location. Escape returns to the block. Shortcuts Duplicate, Move up, Move down, and Delete run while the block is selected.
- **Proof.** `agent-browser screenshot "$EVIDENCE_DIR/paper-edit-saved.png"` of the reloaded editor, plus the api read above.
- **Letter.** Create a job with `POST /api/commands/job.create` and body `{"title":"Associate PM","company":"Northwind"}`. Open `/paper`, choose `Cover letter`, choose the button `Associate PM, Northwind`, choose `Start blank`. The URL is `/paper/{id}`. Fill the letter textbox with `One line for verify.` Wait 2 s. Reload. The line is still there. Save `agent-browser screenshot "$EVIDENCE_DIR/paper-letter-saved.png"`.
- **Letter caret.** Click the letter textbox, put the caret inside a word, and type one letter. Wait 2 s. The new letter stays inside that word and the caret stays just after it. Save `agent-browser screenshot "$EVIDENCE_DIR/paper-letter-caret.png"`.
- **Letter leave.** Type a word and choose `Paper` within 300 ms. Choose the cover letter card. The word is in the letter. Save `agent-browser screenshot "$EVIDENCE_DIR/paper-letter-left.png"`.
- **Letter reload.** Type another word and reload within 300 ms. The word is still in the letter and in `GET /api/paper/{id}`. Save `agent-browser screenshot "$EVIDENCE_DIR/paper-letter-reloaded.png"`.
- **Download.** On the editor, choose `Download PDF`. The browser print dialog opens on the A4 template (print media, no app chrome). Save a PDF of that print with Chrome `Page.printToPDF`, `preferCSSPageSize` true, and all four margins 0. The page MediaBox is A4, 595 by 842 points. A capture that leaves `preferCSSPageSize` unset saves US Letter instead. A capture that leaves the default margins shrinks the page under 767px and picks up the phone field height. Repeat for Simple, Modern, Compact, Academic and With photo, for a CV tall enough to show `Over one page` and `Page 2`, and for a cover letter. The Modern PDF text contains the role, then the company, then the dates. Empty fields print nothing (no `Add text…`). An entry head stays with its first bullets. On the library card menu, `Download PDF` prints the same template. On the share page, `Download PDF` prints the same template. At 390px the `Download PDF` control is reachable and named. `Keep 2 pages` hides `Over one page` and leaves the page label. Fit to one page is still not driven when the scripted Coach cannot write the document.

## Gotchas

- The editor is URL-addressed. Reload the doc URL. Do not expect a documents table.
- The name field on the page is `Full name`. The document title in the breadcrumb is the textbox `Document name`.
- A blank CV has no Summary field. Role and Company are separate fields. The Role placeholder is `Role, company`. School and Degree are separate fields. The School placeholder is `School, degree`. Location sits after the bullets. Bold, Italic, and Underline are not in the toolbar.
- Fit to one page is not part of this recipe. The scripted Coach may not return a `paper.edit` tool result. Report that step as not driven when a later pass tries it.
- The card menu, search with no match, Copy link, and the suggestion card are not part of this recipe.
