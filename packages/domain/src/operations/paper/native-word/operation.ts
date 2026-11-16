import { z } from "zod"
import { defineOperation } from "../../../operation.js"
import {
  nativeBasisSchema,
  nativeWriterSchema,
} from "../../../paper-doc/native.js"
import type { ResourceRef } from "../../../resources.js"

export const operation = defineOperation({
  owner: "paper",
  name: "paper.nativeWord",
  version: 1,
  kind: "read",
  description: "Qualify an exact saved rich CV or Letter for Word download.",
  input: z
    .object({
      docId: z.string().uuid(),
      kind: z.enum(["cv", "letter"]),
      writer: nativeWriterSchema,
      basis: nativeBasisSchema,
    })
    .strict(),
  publicResult: z
    .object({
      docId: z.string().uuid(),
      kind: z.enum(["cv", "letter"]),
      name: z.string(),
      basis: nativeBasisSchema,
    })
    .strict(),
  coach: "never",
  dependsOn: (): readonly ResourceRef[] => [
    { name: "paper", coachFloor: "auto" },
  ],
})
