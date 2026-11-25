import { z } from "zod"
import {
  connectionResource,
  connectionSchema,
} from "../../../agents/connections.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "connections",
  name: "connections.list",
  version: 1,
  kind: "read",
  description: "Read agent connections",
  input: z.object({}).strict(),
  publicResult: z.array(connectionSchema),
  coach: "never",
  dependsOn: () => [connectionResource],
})
