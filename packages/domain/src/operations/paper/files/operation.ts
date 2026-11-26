import { z } from "zod"
import { defineOperation } from "../../../operation.js"
import type { ResourceRef } from "../../../resources.js"

export const operation = defineOperation({
  owner: "paper",
  name: "paper.files",
  version: 1,
  kind: "read",
  description:
    "List the person's uploaded files, newest first: name, media type and size. The bytes stay in the store.",
  label: "Look at your Paper files",
  readLabel: "Looked at your Paper files",
  input: z.object({}).strict(),
  publicResult: z.array(
    z
      .object({
        id: z.string().uuid(),
        name: z.string(),
        mediaType: z.string(),
        byteSize: z.number().int(),
        createdAt: z.string().datetime(),
      })
      .strict()
  ),
  coach: "never",
  dependsOn: (): readonly ResourceRef[] => [
    { name: "file", coachFloor: "auto" },
  ],
})
