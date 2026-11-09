import { z } from "zod"
import { defineOperation } from "../../../operation.js"
import type { ResourceRef } from "../../../resources.js"
import { paperPackageMetadataSchema } from "../../../paper-package.js"
import { paperImportInputSchema } from "../../../paper.js"

type ImportInput =
  { fileId: string } | { generation: "package"; stageId: string }

export const operation = defineOperation({
  owner: "paper",
  name: "paper.import",
  version: 1,
  kind: "command",
  description: "Import an uploaded file or publish a staged Word document.",
  input: z
    .object({
      fileId: paperImportInputSchema.shape.fileId.optional(),
      generation: z.literal("package").optional(),
      stageId: z.string().uuid().optional(),
    })
    .strict()
    .transform((input, ctx): ImportInput => {
      if (
        input.fileId !== undefined &&
        input.generation === undefined &&
        input.stageId === undefined
      )
        return { fileId: input.fileId }
      if (
        input.fileId === undefined &&
        input.generation === "package" &&
        input.stageId !== undefined
      )
        return { generation: input.generation, stageId: input.stageId }
      ctx.addIssue({
        code: "custom",
        message: "Choose an uploaded file or a staged Word document.",
      })
      return z.NEVER
    }),
  publicResult: z.union([
    z
      .object({
        id: z.string().uuid(),
        name: z.string(),
        kind: z.enum(["cv", "letter", "proof"]),
        contentVersion: z.number().int(),
        sourceFileId: z.string().uuid().nullable(),
      })
      .strip(),
    paperPackageMetadataSchema.strip(),
  ]),
  coach: "auto",
  destructive: false,
  idempotency: "keyed",
  writes: (): readonly ResourceRef[] => [{ name: "paper", coachFloor: "auto" }],
})
