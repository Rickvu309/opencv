import { randomUUID } from "node:crypto"

import { catalog, parseJobId } from "@workspace/domain/kernel"
import {
  PAPER_CANVAS_PROFILE,
  paperPackageEditResultSchema,
} from "@workspace/domain/paper-doc"
import { operation } from "@workspace/domain/operations/paper/canvas"
import type { z } from "zod"

import {
  undoOnlyReversal,
  type OperationBinding,
} from "../../../registry/bind.js"
import {
  canvasAhead,
  mintedBytes,
  mintedName,
  prepareCanvas,
  resultOf,
} from "../../word-package/package-canvas.js"
import { commitWordCandidate } from "../../word-package/package-candidates.js"
import { publishWordPackage, stageWordPackage } from "../../package-store.js"
import { WORD_UNDO_MOVED } from "../../word-package/word/document.js"

type CanvasResult = z.output<typeof paperPackageEditResultSchema>

export const implementation = {
  operation,
  transaction: "none",
  prepare: async (input, actor, registry) => {
    if (input.op === "mint") {
      if (input.jobId)
        await registry.read(
          catalog["job.get"].name,
          { jobId: parseJobId(input.jobId) },
          actor
        )
      const stage = await stageWordPackage(
        actor.userId,
        {
          requestId: randomUUID(),
          name: mintedName(input),
          kind: input.label,
        },
        mintedBytes(input)
      )
      return { op: "mint" as const, stageId: stage.stageId }
    }
    return {
      op: "edit" as const,
      prepared: await prepareCanvas(actor.userId, input),
    }
  },
  execute: async (input, actor, registry, ahead?) => {
    const staged = canvasAhead(ahead)
    if (staged.op === "mint") {
      const published = await publishWordPackage(
        actor.userId,
        staged.stageId,
        PAPER_CANVAS_PROFILE
      )
      if (input.op === "mint" && input.jobId)
        await registry.execute({
          name: catalog["job.linkPaper"].name,
          input: {
            jobId: parseJobId(input.jobId),
            docId: published.docId,
            kind: input.label,
          },
          actor,
        })
      return resultOf(actor.userId, published.docId, published.revision, null)
    }
    const published = await commitWordCandidate(actor.userId, input, {
      candidate: staged.prepared.candidate,
      review: staged.prepared.review,
    })
    return resultOf(
      actor.userId,
      published.docId,
      published.revision,
      published.restore
    )
  },
  reversal: (input, result) =>
    result.restore && input.op === "write"
      ? undoOnlyReversal({
          command: "paper.undoWord",
          input: {
            doc: result.docId,
            revision: result.revision,
            restore: input.batch.basedOn,
          },
          expect: {
            query: catalog["paper.read"].name,
            input: { docId: result.docId },
            matches: { revision: result.revision },
            skipped: WORD_UNDO_MOVED,
          },
        })
      : {
          irreversible: "A new Word page is deleted from the library instead.",
        },
  activity: (_input, result) => ({
    subjectKind: "paper",
    subjectId: result.docId,
    summary: "Wrote on the page",
  }),
} satisfies OperationBinding<typeof operation, CanvasResult>
