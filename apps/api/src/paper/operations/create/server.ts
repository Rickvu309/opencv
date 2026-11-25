import { catalog, parseJobId } from "@workspace/domain"
import { operation } from "@workspace/domain/operations/paper/create"
import type { OperationBinding } from "../../../registry/bind.js"
import { deleteNewPaper } from "../../new-paper-undo.js"
import { createPaper } from "../../store.js"

type Created = Awaited<ReturnType<typeof createPaper>>

export const implementation = {
  operation,
  execute: async (input, actor, registry) => {
    const created = await createPaper(actor, {
      kind: input.kind,
      name: input.name,
    })
    if (input.jobId)
      await registry.execute({
        name: catalog["job.linkPaper"].name,
        input: {
          jobId: parseJobId(input.jobId),
          docId: created.id,
          kind: input.kind,
        },
        actor,
      })
    return created
  },
  reversal: (_input, result) => deleteNewPaper(result),
  activity: (_input, result) => ({
    subjectKind: "paper",
    subjectId: result.id,
    summary: `Created ${result.name}`,
  }),
} satisfies OperationBinding<typeof operation, Created>
