import { catalog, parseJobId } from "@workspace/domain/kernel"
import { PAPER_START_TEMPLATE } from "@workspace/domain/paper-doc"
import { operation } from "@workspace/domain/operations/paper/start"
import { z } from "zod"

import type { OperationBinding } from "../../../registry/bind.js"
import { startedName, startingPaper } from "../../new-paper.js"
import { createPaper } from "../../store.js"
import { startingPage } from "../create/server.js"

type Started = { docId: string; name: string; kind: "cv" | "letter" }

const jobNamesSchema = z.object({ company: z.string() })

export const implementation = {
  operation,
  execute: async (input, actor, registry) => {
    const company = input.jobId
      ? jobNamesSchema.parse(
          await registry.read(
            catalog["job.get"].name,
            { jobId: parseJobId(input.jobId) },
            actor
          )
        ).company
      : null
    const templateId =
      input.kind === "cv"
        ? (input.templateId ?? PAPER_START_TEMPLATE)
        : undefined
    const created = await createPaper(actor, {
      kind: input.kind,
      name: startedName(input, company),
      ...(templateId ? { templateId } : {}),
      paper: startingPaper({ kind: input.kind, templateId }),
      page: startingPage({ kind: input.kind, templateId }),
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
    return { docId: created.id, name: created.name, kind: input.kind }
  },
  reversal: {
    irreversible: "A started Paper is deleted from the library instead.",
  },
  activity: (_input, output) => ({
    subjectKind: "paper",
    subjectId: output.docId,
    summary: `Started ${output.name}`,
  }),
} satisfies OperationBinding<typeof operation, Started>
