import { parseFileId } from "@workspace/domain/kernel"
import { operation } from "@workspace/domain/operations/paper/delete-file"
import type { OperationBinding } from "../../../registry/bind.js"
import { deleteFile } from "../../store.js"

export const implementation = {
  operation,
  execute: (input, actor) => deleteFile(actor, parseFileId(input.fileId)),
  reversal: { irreversible: "An uploaded file is deleted for good." },
  activity: { silent: "Deleting a file writes no receipt, as before." },
} satisfies OperationBinding<
  typeof operation,
  import("zod").output<typeof operation.publicResult>
>
