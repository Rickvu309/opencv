import {
  commandContract,
  commandEntry,
  queryContract,
  queryEntry,
} from "./contract.js"
import type { QueryRef } from "./queries.js"
import type { PaperId } from "./ids.js"
import {
  richEditInputSchema,
  richEditOutputSchema,
  richReadInputSchema,
  richReadOutputSchema,
} from "./paper-rich-edit.js"

export const richPaperQueries = queryContract({
  "paper.readRich": queryEntry({
    input: richReadInputSchema,
    output: richReadOutputSchema,
  }),
})

export function richPaperCommands(
  invalidates: (input: { docId: PaperId }) => QueryRef[]
) {
  return commandContract({
    "paper.editRich": commandEntry({
      delegate: { resource: "paper", access: "proposal" },
      description:
        "Propose text or formatting edits to a rich CV or Letter. Read paper.readRich first and copy its basis and writer unchanged. Address a text block and a UTF-16 range using from, to and exact before text. replaceText preserves surrounding formatting; formatText merges only the supplied marks. Nothing changes until the person approves the exact Before and After. Approval refuses if the document changed. Use only facts the person supplied. Tables, photos and page layout cannot be edited with this command.",
      input: richEditInputSchema,
      output: richEditOutputSchema,
      coach: "confirm",
      destructive: false,
      step: () => "Edit the document",
      invalidates,
    }),
  })
}
