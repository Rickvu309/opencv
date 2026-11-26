import { parsePaperId } from "@workspace/domain/kernel"
import { operation } from "@workspace/domain/operations/paper/delete"
import type { OperationBinding } from "../../../registry/bind.js"
import { deletePaper } from "../../store.js"

export const implementation = {
  operation,
  execute: (input, actor) => deletePaper(actor, parsePaperId(input.docId)),
  reversal: { irreversible: "A Paper is deleted for good." },
  activity: { silent: "Deleting a Paper leaves no receipt to undo from." },
} satisfies OperationBinding<
  typeof operation,
  import("zod").output<typeof operation.publicResult>
>
