# Paper

The documents a person sends to get a job.

## Language

**Paper**:
One document a person owns: a CV or a Letter.
_Avoid_: document, doc, file

**CV**:
A Paper that presents the person's experience.
_Avoid_: resume

**Letter**:
A Paper written to one employer about one Job.
_Avoid_: cover letter

**Proof**:
Evidence that backs a claim in a Paper. The content schema has a proof kind, but no command creates one and the page is a placeholder.

**Page**:
What a Paper looks like on a sheet, on every screen. Laid out once, it is the same on screen, on a library card and in the PDF; A4 unless the person picks another size.
_Avoid_: canvas, sheet

**Block**:
One paragraph, heading, list item, photo, table, divider or page break on a Paper. A list item is a Block with a level, never a Block inside another.
_Avoid_: node, element

**Run**:
A stretch of text inside a Block that has the same formatting.
_Avoid_: span, leaf

**Command**:
One instruction that changes a Paper, the same whether it comes from the keyboard, the toolbar, Coach or an outside agent.
_Avoid_: op, transaction

**Change**:
The steps one Edit made, with the version it was made on and who made it. The server keeps every Paper as one ordered list of Changes.
_Avoid_: delta, revision

**Suggestion**:
A Change that Coach or an outside agent proposes. It shows on the Page, and it is applied only when the person accepts it.
_Avoid_: proposal, diff

**Edit**:
One change to a Paper's content.
_Avoid_: patch, operation

**Stale edit**:
An edit made against a version of the Paper that has since changed.

**Word file**:
A `.docx` a person brings in or takes out.
_Avoid_: package, Word page, Word document

**Template**:
A starting layout for a new CV.

**Paper Loop**:
Bring a Word file in, change it by chat, approve, take a Word file out.
