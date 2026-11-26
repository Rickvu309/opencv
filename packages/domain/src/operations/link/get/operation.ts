import { z } from "zod"
import { defineOperation } from "../../../operation.js"
import type { ResourceRef } from "../../../resources.js"

export const operation = defineOperation({
  owner: "coach",
  name: "link.get",
  version: 1,
  kind: "read",
  description: "Read a link host. The page is not fetched.",
  input: z.object({ url: z.string().trim().min(1).max(2000) }).strict(),
  publicResult: z.object({ url: z.string(), host: z.string() }).strict(),
  coach: "auto",
  dependsOn: (): readonly ResourceRef[] => [],
})
