---
status: accepted, amended by 0009
---

# A Paper is one document, and Word is a door

Paper stored four kinds of document: an older block document, a native document, a rich document and a Word page that kept the imported file as the source of truth. Three editors were reachable and 33 operations served them, several as the same verb once per kind. On 2026-11-08 the Word file was chosen as the source of truth so that export returned the original untouched. Since then the product moved to a free writing page, and blank Papers open the rich editor.

The rich document is the Paper. Bringing a Word file in converts it to a Paper and keeps the original file beside it. Taking a Word file out writes a new file from the Paper. The older block and native documents are removed with their data, which is test data.

## Considered options

- Keep Word pages as a second kind of Paper: an untouched original on export, at the cost of two editors and two edit paths for the Coach and for a person's own agents, for good.
- Convert on the way in and write a new file on the way out: one editor and one edit path, and an exported file whose fonts and page breaks can differ from the one brought in.

## Consequences

- Paper has one way to read and one way to edit.
- The format of the stored document is hidden inside Paper, so it can change again without touching another context.
- An exported Word file is not byte for byte the imported one. The original stays available beside the Paper.
