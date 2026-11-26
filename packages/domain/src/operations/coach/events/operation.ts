import {
  coachTaskEventsInputSchema,
  coachTaskReplaySchema,
  coachTaskResource,
} from "../../../coach/coach-task.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "coach",
  name: "coach.events",
  version: 1,
  kind: "read",
  description: "Read ordered Coach task events after a cursor.",
  label: "Read Coach updates",
  readLabel: "Read Coach updates",
  input: coachTaskEventsInputSchema,
  publicResult: coachTaskReplaySchema,
  coach: "never",
  dependsOn: () => [coachTaskResource],
})
