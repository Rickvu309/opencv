import { z } from "zod"
import { defineOperation } from "../../../operation.js"
import type { ResourceRef } from "../../../resources.js"

export const operation = defineOperation({
  owner: "paper",
  name: "paper.import",
  version: 3,
  kind: "command",
  description:
    "Make a Paper from a file the person brought in. Read an uploaded Word file into a Paper and report any parts that were left out.",
  label: "Import your Paper",
  input: z
    .object({
      fileId: z.string().uuid(),
      kind: z.enum(["cv", "letter"]),
      name: z.string().trim().min(1).max(200),
      paper: z.unknown(),
      engine: z.literal(2).optional(),
    })
    .strict()
    .refine((input) => input.engine !== 2 || input.paper === null),
  publicResult: z
    .object({
      docId: z.string().uuid(),
      name: z.string().min(1).max(200),
      kind: z.enum(["cv", "letter"]),
      dropped: z.array(z.string().min(1)).optional(),
    })
    .strip(),
  coach: "never",
  destructive: false,
  idempotency: "keyed",
  writes: (): readonly ResourceRef[] => [{ name: "paper", coachFloor: "auto" }],
})
