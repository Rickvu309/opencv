import { ERROR_CODES, type Actor } from "@workspace/domain"
import { z } from "zod"

import { CommandError } from "../registry/errors.js"
import type { Registry } from "../registry/registry.js"
import { draftWithHint } from "./draft-coach.js"
import {
  addToCalendar,
  clearSuggestion,
  fixtureDraft,
  readInboxThread,
  scanInbox,
  sendReply,
  setThreadStatus,
  skipInbox,
  updateDraft,
} from "./store.js"

let commandsAdded = false

const emptyInput = z.object({}).strict()

const threadInput = z
  .object({
    threadId: z.string().uuid(),
  })
  .strict()

const markDoneInput = z
  .object({
    threadId: z.string().uuid(),
    status: z.enum(["open", "done", "snoozed"]).optional(),
  })
  .strict()

const snoozeInput = z
  .object({
    threadId: z.string().uuid(),
    until: z.string().datetime().nullable(),
  })
  .strict()

const draftInput = z
  .object({
    threadId: z.string().uuid(),
    hint: z.string().trim().min(1).max(8000).optional(),
  })
  .strict()

const updateInput = z
  .object({
    threadId: z.string().uuid(),
    body: z.string().max(20_000),
  })
  .strict()

const calendarInput = z
  .object({
    threadId: z.string().uuid(),
    start: z.string().datetime(),
  })
  .strict()

type MarkDoneInput = z.infer<typeof markDoneInput>
type SnoozeInput = z.infer<typeof snoozeInput>

export function registerInbox(registry: Registry) {
  if (commandsAdded) return
  commandsAdded = true

  registry.addCommand(
    {
      name: "inbox.skip",
      description: "Skip Gmail for now.",
      input: emptyInput,
      coach: "never",
      destructive: false,
      reversal: () => null,
      step: () => "Skip inbox for now",
      activity: () => null,
    },
    (_input, actor: Actor) => skipInbox(actor)
  )

  registry.addCommand(
    {
      name: "inbox.scan",
      description: "Read job emails from the mail provider.",
      input: emptyInput,
      coach: "auto",
      destructive: false,
      reversal: () => null,
      step: () => "Scan job emails",
      activity: () => null,
    },
    (_input, actor: Actor) => scanInbox(actor)
  )

  registry.addCommand(
    {
      name: "inbox.markDone",
      description: "Mark an email done.",
      input: markDoneInput,
      coach: "auto",
      destructive: false,
      reversal: (input, output) => ({
        command: "inbox.markDone",
        input: { threadId: input.threadId, status: output.previousStatus },
      }),
      step: () => "Mark the email done",
      activity: (input) => ({
        subjectKind: "inbox",
        subjectId: input.threadId,
        summary: "Marked the email done",
      }),
    },
    (input: MarkDoneInput, actor: Actor) =>
      setThreadStatus(actor, input.threadId, input.status ?? "done", null)
  )

  registry.addCommand(
    {
      name: "inbox.snooze",
      description: "Snooze an email until a time.",
      input: snoozeInput,
      coach: "auto",
      destructive: false,
      reversal: (input, output) => ({
        command: "inbox.snooze",
        input: {
          threadId: input.threadId,
          until: output.previousSnoozeUntil,
        },
      }),
      step: () => "Snooze the email",
      activity: (input) => ({
        subjectKind: "inbox",
        subjectId: input.threadId,
        summary: "Snoozed the email",
      }),
    },
    (input: SnoozeInput, actor: Actor) => {
      const until = input.until == null ? null : new Date(input.until)
      return setThreadStatus(
        actor,
        input.threadId,
        until ? "snoozed" : "open",
        until
      )
    }
  )

  registry.addCommand(
    {
      name: "inbox.clearSuggestion",
      description: "Dismiss a stage suggestion.",
      input: threadInput,
      coach: "never",
      destructive: false,
      reversal: () => null,
      step: () => "Dismiss the suggestion",
      activity: () => null,
    },
    (input, actor: Actor) => clearSuggestion(actor, input.threadId)
  )

  registry.addCommand(
    {
      name: "inbox.acceptSuggestion",
      description: "Move the linked job to the suggested stage.",
      input: threadInput,
      coach: "never",
      destructive: false,
      reversal: () => null,
      step: () => "Move the job to Interview",
      activity: () => null,
    },
    async (input, actor: Actor) => {
      const detail = await readInboxThread(actor.userId, input.threadId)
      if (!detail.jobId) {
        throw new CommandError(
          ERROR_CODES.VALIDATION_ERROR,
          "This email is not linked to a job yet."
        )
      }
      if (detail.suggestedStage !== "interview") {
        throw new CommandError(
          ERROR_CODES.VALIDATION_ERROR,
          "There is no stage to move this job to."
        )
      }
      const moved = await registry.execute({
        name: "job.move",
        input: { jobId: detail.jobId, stage: detail.suggestedStage },
        actor,
      })
      await clearSuggestion(actor, input.threadId)
      if (!moved.activityId) {
        throw new CommandError(
          ERROR_CODES.INTERNAL_ERROR,
          "Could not move the job. Try it again."
        )
      }
      return {
        id: input.threadId,
        jobId: detail.jobId,
        stage: detail.suggestedStage,
        activityId: moved.activityId,
      }
    }
  )

  registry.addCommand(
    {
      name: "inbox.draftReply",
      description: "Draft a reply. A hint asks the Coach for another one.",
      input: draftInput,
      coach: "auto",
      destructive: false,
      reversal: () => null,
      step: () => "Draft a reply",
      activity: () => null,
    },
    (input, actor: Actor) =>
      input.hint
        ? draftWithHint(registry, actor, input.threadId, input.hint)
        : fixtureDraft(actor, input.threadId)
  )

  registry.addCommand(
    {
      name: "inbox.updateDraft",
      description: "Save an edited reply.",
      input: updateInput,
      coach: "never",
      destructive: false,
      reversal: () => null,
      step: () => "Update the draft",
      activity: () => null,
    },
    (input, actor: Actor) => updateDraft(actor, input.threadId, input.body)
  )

  registry.addCommand(
    {
      name: "inbox.send",
      description: "Send the drafted reply.",
      input: threadInput,
      coach: "never",
      destructive: true,
      reversal: () => null,
      step: () => "Send the reply",
      activity: () => null,
    },
    (input, actor: Actor) => sendReply(actor, input.threadId)
  )

  registry.addCommand(
    {
      name: "inbox.addToCalendar",
      description: "Add the selected time to the calendar.",
      input: calendarInput,
      coach: "never",
      destructive: false,
      reversal: () => null,
      step: () => "Add the time to the calendar",
      activity: () => null,
    },
    (input, actor: Actor) => addToCalendar(actor, input.threadId, input.start)
  )
}
