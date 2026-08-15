# Paper is a union of types, not two artefacts

A CV is sections and dated entries. A letter is paragraphs. One struct cannot hold both without lying: empty themes on a letter, completeness scores on headings a letter does not have.

The rejected alternative was two artefacts (and two routes, two store keys, two action families). That made type look like a product. The person has one library of papers.

So Paper is one artefact with a `type` field. `CvPaper` and `LetterPaper` are layouts inside that module. Callers see `Paper`. The Coach uses `paper.*` for every kind.
