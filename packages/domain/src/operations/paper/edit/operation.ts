import { z } from "zod"
import { defineOperation } from "../../../operation.js"
import type { ResourceRef } from "../../../resources.js"
import { formatRunSchema } from "../../../paper-doc/native-formatting.js"
import { agentCommandSchema } from "../../../paper-doc/engine-command.js"

const agentCommandsSchema: z.ZodType<z.input<typeof agentCommandSchema>[]> = z
  .array(agentCommandSchema)
  .min(1)
  .max(30)

const publicRun = formatRunSchema
  .omit({ href: true })
  .extend({ href: z.string().optional() })
  .strict()

const publicRichEdit = z
  .object({
    format: z.literal("rich"),
    docId: z.string().uuid(),
    name: z.string(),
    changes: z
      .array(
        z
          .object({
            blockId: z.string(),
            before: z.array(publicRun),
            after: z.array(publicRun),
          })
          .strict()
      )
      .min(1)
      .max(30),
    revision: z.number().int().nonnegative(),
    editId: z.string().uuid(),
  })
  .strip()

export const operation = defineOperation({
  owner: "paper",
  name: "paper.edit",
  version: 3,
  kind: "command",
  description:
    "Propose a change to a CV or Letter. Nothing is written until the person approves it in OpenCV; a pending result means the document is unchanged. Read it first with paper.outline (paper_read for an agent) and copy its revision as basedOn. Send commands: replaceText swaps a UTF-16 range of a block for new text, formatText turns bold, italic or underline on or off for a range, insertBlocks adds text blocks after a block, removeBlocks deletes blocks, and setBlockType changes their kind. Every command carries expect, the exact current text of its range or blocks; a mismatch is refused, never guessed. Tables, photos and page layout cannot be edited this way. Use only facts the person gave; do not invent the person's experience or qualifications. If the text changed where you wanted to edit, the edit or its approval is refused and the document stays as it is; read it again and propose again.",
  label: "Edit your Paper",
  input: z
    .object({
      docId: z.string().uuid(),
      basedOn: z.number().int().min(0),
      commands: agentCommandsSchema,
    })
    .strict(),
  publicResult: publicRichEdit,
  coach: "confirm",
  delegateRefusal:
    "This connection cannot propose document edits. Stop and ask the person to reconnect.",
  coachPermission: "agentCvs",
  delegate: { resource: "paper", access: "proposal" },
  destructive: false,
  idempotency: "keyed",
  writes: (input): readonly ResourceRef[] => [
    { name: "paper", coachFloor: "auto", entityId: input.docId },
  ],
})
