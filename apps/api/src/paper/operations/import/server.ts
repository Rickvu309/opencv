import { z } from "zod"
import { operation } from "@workspace/domain/operations/paper/import"
import {
  ERROR_CODES,
  parseFileId,
  paperViewSchema,
  paperPackageMetadataSchema,
} from "@workspace/domain"
import type { OperationBinding } from "../../../registry/bind.js"
import { CommandError } from "../../../registry/errors.js"
import { publishWordPackage } from "../../package-store.js"
import { importPaper } from "../../store.js"

export const implementation = {
  operation,
  privateResult: z.union([paperViewSchema, paperPackageMetadataSchema]),
  execute: (input, actor) => {
    if ("fileId" in input) return importPaper(actor, parseFileId(input.fileId))
    if (process.env.PAPER_PACKAGE_ENABLED !== "true")
      throw new CommandError(
        ERROR_CODES.NOT_FOUND,
        "Word package import is unavailable."
      )
    return publishWordPackage(actor.userId, input.stageId)
  },
  reversal: (_input, output) =>
    "generation" in output
      ? null
      : {
          command: "paper.delete",
          input: { docId: output.id },
          expect: {
            query: "paper.get",
            input: { docId: output.id },
            matches: {
              contentVersion: output.contentVersion,
              name: output.name,
            },
            skipped: "This document changed after import, so Undo was skipped.",
          },
        },
  activity: (_input, output) => ({
    subjectKind: "paper",
    subjectId: "generation" in output ? output.docId : output.id,
    summary: `Imported ${output.name}`,
  }),
} satisfies OperationBinding<
  typeof operation,
  | Awaited<ReturnType<typeof importPaper>>
  | Awaited<ReturnType<typeof publishWordPackage>>
>
