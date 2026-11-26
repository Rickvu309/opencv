import { z } from "zod"
import { defineOperation } from "../../../operation.js"
import type { ResourceRef } from "../../../resources.js"

export const operation = defineOperation({
  owner: "paper",
  name: "file.get",
  version: 1,
  kind: "read",
  description: "Read a file's name and size. The bytes stay in the store.",
  input: z.object({ fileId: z.string().uuid() }).strict(),
  publicResult: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      mediaType: z.string(),
      byteSize: z.number().int(),
    })
    .strict(),
  coach: "auto",
  dependsOn: (input): readonly ResourceRef[] => [
    { name: "file", coachFloor: "auto", entityId: input.fileId },
  ],
})
