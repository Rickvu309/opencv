import { z } from "zod"

declare const TextEncoder: {
  new (): { encode(value: string): Uint8Array }
}

export const PAPER_PACKAGE_LIMITS = Object.freeze({
  uploadBytes: 8 * 1024 * 1024,
  projectionBytes: 64 * 1024 * 1024,
  pageBytes: 64 * 1024,
  pageRegions: 16,
  textBytes: 8 * 1024,
  cursorBytes: 2048,
})

export const PAPER_PACKAGE_PROJECTOR = "paper-package-spans-1"
const paperPackageRevisionSchema = z.string().uuid()
const identity = z.string().uuid()
const location = z
  .object({
    paragraph: z.number().int().nonnegative(),
    kind: z.enum(["paragraph", "table-cell"]),
  })
  .strict()
const refusal = z.object({ code: z.string(), message: z.string() }).strict()
const finiteText = z
  .string()
  .refine(
    (text) =>
      new TextEncoder().encode(text).byteLength <=
      PAPER_PACKAGE_LIMITS.textBytes,
    "This text is larger than the supported Word region."
  )
const editable = z
  .object({
    kind: z.literal("editable"),
    paragraph: z.string().uuid().optional(),
    targetId: z.string().regex(/^t_[a-f0-9]{64}$/),
    text: finiteText,
    location,
    formatting: z.discriminatedUnion("kind", [
      z
        .object({
          kind: z.literal("known"),
          scope: z.literal("direct-run-properties"),
          properties: z.array(
            z
              .object({
                name: z.string(),
                values: z.array(
                  z.object({ name: z.string(), value: z.string() }).strict()
                ),
              })
              .strict()
          ),
        })
        .strict(),
      z
        .object({
          kind: z.literal("inherited"),
          scope: z.literal("preserved-uncomputed"),
        })
        .strict(),
    ]),
    context: z.object({ paragraphText: finiteText }).strict(),
  })
  .strict()
const locked = z
  .object({
    kind: z.literal("locked"),
    paragraph: z.string().uuid().optional(),
    text: z.string(),
    location,
    reason: refusal,
    complete: z.boolean(),
  })
  .strict()

export const paperPackageProjectionSchema = z
  .object({
    docId: identity,
    incarnation: identity,
    revision: paperPackageRevisionSchema,
    profile: z.string(),
    regions: z.array(z.discriminatedUnion("kind", [editable, locked])),
  })
  .strict()

export const paperPackageMetadataSchema = z
  .object({
    generation: z.literal("package"),
    docId: identity,
    revision: paperPackageRevisionSchema,
    name: z.string().min(1).max(200),
    kind: z.enum(["cv", "letter"]),
    packageHash: z.string().regex(/^[a-f0-9]{64}$/),
    byteSize: z.number().int().positive().max(PAPER_PACKAGE_LIMITS.uploadBytes),
  })
  .strict()

export const paperImportResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z
      .object({
        docId: z.string().uuid(),
        name: z.string().min(1).max(200),
        kind: z.enum(["cv", "letter"]),
        notice: z.string().min(1).optional(),
      })
      .strict(),
  })
  .strict()

export const paperPackageStageInputSchema = z
  .object({
    requestId: identity,
    name: z.string().min(1).max(200),
    kind: z.enum(["cv", "letter"]),
  })
  .strict()
const packageText = z
  .string()
  .refine(
    (value) =>
      new TextEncoder().encode(value).byteLength <=
      PAPER_PACKAGE_LIMITS.textBytes,
    "This text is larger than the supported Word region."
  )
const packageReplacement = z
  .object({
    op: z.literal("replaceText"),
    targetId: z.string().regex(/^t_[a-f0-9]{64}$/),
    before: packageText.refine((value) => value.length > 0),
    after: packageText,
  })
  .strict()
export const paperPackageEditsSchema = z
  .array(packageReplacement)
  .min(1)
  .max(20)
export const paperPackageEditSchema = z
  .object({
    docId: identity,
    basedOn: identity,
    edits: paperPackageEditsSchema,
  })
  .strict()
export const paperPackageEditResultSchema = paperPackageMetadataSchema
  .extend({
    incarnation: identity,
    restore: z
      .object({
        id: identity,
        digest: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .strict()
      .nullable(),
  })
  .strict()
export const paperPackageStageSchema = paperPackageMetadataSchema
  .extend({ stageId: identity })
  .strict()
export const paperPackageReadInputSchema = z
  .object({
    docId: identity,
    at: paperPackageRevisionSchema.optional(),
    cursor: z.string().min(1).max(PAPER_PACKAGE_LIMITS.cursorBytes).optional(),
  })
  .strict()
export const paperPackageReadSchema = paperPackageMetadataSchema
  .extend({
    projector: z.literal(PAPER_PACKAGE_PROJECTOR),
    regions: z
      .array(
        z.discriminatedUnion("kind", [
          editable,
          locked
            .extend({ text: finiteText, continuation: z.boolean() })
            .strict(),
        ])
      )
      .max(PAPER_PACKAGE_LIMITS.pageRegions),
    nextCursor: z.string().max(PAPER_PACKAGE_LIMITS.cursorBytes).nullable(),
  })
  .strict()

export const paperWordReadSchema = paperPackageMetadataSchema
  .extend({
    paragraphs: z
      .array(
        z
          .object({
            handle: identity,
            text: finiteText,
            held: z.boolean(),
            message: z.string(),
            complete: z.boolean(),
            continuation: z.boolean(),
          })
          .strict()
      )
      .max(PAPER_PACKAGE_LIMITS.pageRegions),
    nextCursor: z.string().max(PAPER_PACKAGE_LIMITS.cursorBytes).nullable(),
  })
  .strict()

export type PaperPackageProjection = z.infer<
  typeof paperPackageProjectionSchema
>
export type PaperPackageMetadata = z.infer<typeof paperPackageMetadataSchema>
export type PaperPackageRead = z.infer<typeof paperPackageReadSchema>
export type PaperPackageStageInput = z.infer<
  typeof paperPackageStageInputSchema
>
export {
  PAPER_CANVAS_PROFILE,
  paperCanvasCommitSchema,
} from "./paper-canvas.js"
export type { PaperCanvasCommit } from "./paper-canvas.js"
