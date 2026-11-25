import { catalog, paperIdSchema } from "@workspace/domain"
import { operation } from "@workspace/domain/operations/job/link-paper"
import type { OperationBinding } from "../../../registry/bind.js"
import { linkPaper } from "../../linked-papers.js"

const privateResult = operation.publicResult
  .extend({ previousDocId: paperIdSchema.nullable() })
  .strict()

const skipped = "This link changed again, so Undo was skipped"

export const implementation = {
  operation,
  privateResult,
  execute: (input, actor) =>
    linkPaper(actor, input.jobId, input.docId, input.kind),
  reversal: (input, result) => {
    const expect = {
      query: catalog["job.get"].name,
      input: { jobId: input.jobId },
      matches: {
        [input.kind === "cv" ? "cvDocId" : "letterDocId"]: input.docId,
      },
      skipped,
    }
    return result.previousDocId
      ? {
          command: operation.name,
          input: {
            jobId: input.jobId,
            docId: result.previousDocId,
            kind: input.kind,
          },
          expect,
        }
      : {
          command: catalog["job.unlinkPaper"].name,
          input: { jobId: input.jobId, kind: input.kind },
          expect,
        }
  },
  activity: (_input, result) => ({
    subjectKind: "job",
    subjectId: result.id,
    summary: `You linked ${result.docName}`,
  }),
} satisfies OperationBinding<
  typeof operation,
  Awaited<ReturnType<typeof linkPaper>>
>
