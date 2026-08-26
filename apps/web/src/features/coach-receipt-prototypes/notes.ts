/** Review notes for QVE-152. Also posted on the Linear ticket. */
export const PROTOTYPE_CHOICE =
  "Third Command: paper.createDoc. Spec 5's user story names move a card, update my CV, and start a doc. Create is the other Paper action Users watch land in the drive."

export const GRADUATION_NOTES = [
  {
    heading: "What is better than the generic line",
    items: [
      "paper.updateContent: kind + doc name + a short section-scoped diff. The generic line only says the file changed. Users asked the Coach to rewrite a CV or Letter; they need to scan the edit before (or instead of) opening Paper.",
      "apply.moveCard: card title, company, from-Stage, and to-Stage in board language (Inbox → Prep, with the same Stage dots as Apply). Production already names the card and the destination; it hides the origin, which is the fact Users check.",
      "paper.createDoc: kind badge, Draft status, and a first-page skim. Generic copy already says Created CV Untitled CV — the skim is what tells the User the Coach started a blank file, not a filled starter.",
      "Drop Ran <command> — from the visible headline. The check already means it ran. The Command id is for agents and evals, not for the Thread.",
    ],
  },
  {
    heading: "What is noise",
    items: [
      "Full document dumps, contentVersion, and every whitespace change. A receipt is a scan, not an editor.",
      "beforeCardId / position on a move. Board language is Stage to Stage; order inside a column is for the board, not the Thread.",
      "A persistent A4 thumbnail or a move animation in production. Both help a reviewer feel the surface; both steal height in a real Thread and fight the calm Home column.",
      "Open in Paper / Open on Apply as receipt chrome until those surfaces have a real deep link. Coach text can already point the User there.",
      "Field-by-field dumps for apply.updateCard (the unused alternative). Notes and Track edits are better as one sentence plus the changed field, or they stay generic.",
    ],
  },
  {
    heading: "Graduate into production (after review)",
    items: [
      "Named headlines without Ran <command> — for these three Commands only.",
      "apply.moveCard: from-Stage and to-Stage with Stage labels and dots. No mini board, no animation.",
      "paper.updateContent: kind, name, and a collapsed 3-change hunk list. Expand in place. Failures stay one plain line.",
      "paper.createDoc: kind, name, Draft. Skip the A4 chrome unless Paper later exposes a cheap preview payload.",
      "Keep the existing reversal sentence. Do not invent one-click undo here (that is QVE-149).",
    ],
  },
  {
    heading: "Stay generic",
    items: [
      "Reads (list/get), rename, setStatus, linkApplyCard, star, threads.create/rename, profile reads.",
      "Failures. An X plus the error message is already honest. Rich bodies on a failed Command would imply work that did not happen.",
      "Same-Stage moves and empty diffs. If nothing meaningful changed, the generic line is enough.",
      "Command ids in the Thread. Keep them on the tool part for honesty checks and evals.",
    ],
  },
] as const
