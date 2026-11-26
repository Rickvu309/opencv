import {
  coachStartInputSchema,
  coachStartOutputSchema,
  coachTaskResource,
} from "../../../coach/coach-task.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "coach",
  name: "coach.start",
  version: 1,
  kind: "command",
  description: "Queue a durable Coach task.",
  label: "Start Coach",
  input: coachStartInputSchema,
  publicResult: coachStartOutputSchema,
  coach: "never",
  destructive: false,
  idempotency: "none",
  writes: (input) => [
    coachTaskResource,
    { name: "chat", entityId: input.chatId, coachFloor: "never" },
  ],
})
