import { z } from "zod"

import { docCommandSchema, posSchema } from "./engine-command.js"

export const editIdSchema = z.string().min(1).brand<"EditId">()
const versionSchema = z.int().nonnegative()

export const stepJsonSchema = z
  .object({
    stepType: z.enum([
      "replace",
      "replaceAround",
      "addMark",
      "removeMark",
      "attr",
      "docAttr",
    ]),
  })
  .catchall(z.json())

export const originSchema = z.strictObject({
  kind: z.enum(["person", "coach", "agent", "import", "system"]),
  actor: z.string().min(1),
  client: z.string().min(1),
  proposal: z.string().min(1).optional(),
})

export const changeSchema = z.strictObject({
  edit: editIdSchema,
  origin: originSchema,
  base: versionSchema,
  steps: z.array(stepJsonSchema),
  inverse: z.array(stepJsonSchema),
  commands: z.array(docCommandSchema),
})

export const refusalSchema = z.discriminatedUnion("code", [
  z.strictObject({
    code: z.literal("expect-mismatch"),
    at: posSchema,
    found: z.string(),
  }),
  z.strictObject({ code: z.literal("no-such-position"), at: posSchema }),
  z.strictObject({ code: z.literal("schema"), detail: z.string() }),
  z.strictObject({ code: z.literal("too-large"), limit: z.string() }),
  z.strictObject({ code: z.literal("stale"), head: versionSchema }),
  z.strictObject({ code: z.literal("unmappable"), edit: editIdSchema }),
])

export type EditId = z.infer<typeof editIdSchema>
export type StepJSON = z.infer<typeof stepJsonSchema>
export type Origin = z.infer<typeof originSchema>
export type Change = z.infer<typeof changeSchema>
export type Refusal = z.infer<typeof refusalSchema>
