import { catalog, parseJobId } from "@workspace/domain/kernel"
import { operation } from "@workspace/domain/operations/paper/create"
import {
  paperEngineBlank,
  templateLines,
  templatePageName,
  type PaperTemplateId,
} from "@workspace/domain/paper-doc"
import type { OperationBinding } from "../../../registry/bind.js"
import { startingPaper } from "../../new-paper.js"
import { deleteNewPaper } from "../../new-paper-undo.js"
import { blocksFromLines } from "../../engine-import-lines.js"
import { admitted, engineLog } from "../../engine-sync-log.js"
import { createPaper } from "../../store.js"

type Created = Awaited<ReturnType<typeof createPaper>>

function startingPage(input: {
  kind: "cv" | "letter"
  templateId?: PaperTemplateId
  lines?: readonly string[]
}) {
  const blank =
    input.kind === "cv"
      ? paperEngineBlank.blankCv()
      : paperEngineBlank.blankLetter()
  const content = blocksFromLines(
    input.templateId
      ? templateLines(input.templateId)
      : (input.lines ?? []).map((text) => ({ style: "Normal" as const, text }))
  )
  return content.length ? { ...blank, content } : blank
}

export const implementation = {
  operation,
  execute: async (input, actor, registry) => {
    const created = await createPaper(actor, {
      kind: input.kind,
      name:
        input.name ??
        (input.templateId ? templatePageName(input.templateId) : undefined),
      ...(input.templateId ? { templateId: input.templateId } : {}),
      paper: startingPaper(input),
    })
    admitted(await engineLog.start(created.id, startingPage(input)))
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
