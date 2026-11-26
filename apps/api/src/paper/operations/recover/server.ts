import { parsePaperId } from "@workspace/domain/kernel"
import { operation } from "@workspace/domain/operations/paper/recover"
import type { OperationBinding } from "../../../registry/bind.js"
import { relinkJobs } from "../../relink-jobs.js"
import { restoreDeletedPaper } from "../../store.js"

export const implementation = {
  operation,
  execute: async (input, actor, registry) => {
    const restored = await restoreDeletedPaper(actor, parsePaperId(input.docId))
    await relinkJobs(registry, actor, restored)
    return restored.page
  },
  reversal: {
    irreversible: "Delete the page again to take it back out.",
  },
  activity: () => null,
} satisfies OperationBinding<
  typeof operation,
  import("zod").output<typeof operation.publicResult>
>
