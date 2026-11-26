import { z } from "zod"
import { defineOperation } from "../../../operation.js"
import type { ResourceRef } from "../../../resources.js"
import {
  nativeBasisSchema,
  nativeWriterSchema,
} from "../../../paper-doc/native.js"
import { formatRunSchema } from "../../../paper-doc/native-formatting.js"
import { richTextEditsSchema } from "../../../paper-doc/paper-rich-edit.js"

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
  version: 2,
  kind: "command",
  description:
    "Propose a change to a CV or Letter. Nothing is written until the person approves it in OpenCV; a pending result means the document is unchanged. Read it first (paper_read for an agent, paper.outline for the Coach), copy its revision as basedOn and its nativeBasis unchanged. Address a text block by its id with a UTF-16 range from and to and the exact before text: replaceText replaces that range and keeps the surrounding formatting, and formatText merges only the marks you give. Send several edits in one call to change several blocks. Tables, photos and page layout cannot be edited this way. Use only facts the person gave; do not invent the person's experience or qualifications. If the document changed after that read, the edit or its approval is refused and the document stays as it is; read it again and propose again.",
  label: "Edit your Paper",
  input: z
    .object({
      docId: z.string().uuid(),
      basedOn: z.number().int().min(0),
      writer: nativeWriterSchema.optional(),
      nativeBasis: nativeBasisSchema.optional(),
      edits: richTextEditsSchema,
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
