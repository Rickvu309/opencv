import { z } from "zod"
import {
  profileResource,
  usageSnapshotSchema,
} from "../../../account/account.js"
import { coachTaskResource } from "../../../coach-task.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "account",
  name: "coach.usage",
  version: 1,
  kind: "read",
  description: "Read Coach usage for the day, session, and week.",
  input: z.object({}).strict(),
  publicResult: usageSnapshotSchema,
  coach: "auto",
  dependsOn: () => [profileResource, coachTaskResource],
})
