import {
  coachTaskResource,
  coachTaskSnapshotSchema,
  coachTaskStatusInputSchema,
} from "../../../coach/coach-task.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "coach",
  name: "coach.status",
  version: 1,
  kind: "read",
  description: "Read a durable Coach task snapshot and cursor.",
  input: coachTaskStatusInputSchema,
  publicResult: coachTaskSnapshotSchema,
  coach: "never",
  dependsOn: () => [coachTaskResource],
})
