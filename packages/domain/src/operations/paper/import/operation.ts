import { z } from "zod"
import { defineOperation } from "../../../operation.js"
import type { ResourceRef } from "../../../resources.js"

export const operation = defineOperation({
  owner: "paper",
  name: "paper.import",
  version: 2,
  kind: "command",
  description:
    "Make a Paper from a file the person brought in. The file is read and converted before this runs, and the uploaded file stays stored beside the Paper.",
  label: "Import your Paper",
  input: z
    .object({
      fileId: z.string().uuid(),
      kind: z.enum(["cv", "letter"]),
      name: z.string().trim().min(1).max(200),
      paper: z.unknown(),
    })
    .strict(),
  publicResult: z
    .object({
      docId: z.string().uuid(),
      name: z.string().min(1).max(200),
      kind: z.enum(["cv", "letter"]),
    })
    .strip(),
  coach: "never",
  destructive: false,
  idempotency: "keyed",
  writes: (): readonly ResourceRef[] => [{ name: "paper", coachFloor: "auto" }],
})
