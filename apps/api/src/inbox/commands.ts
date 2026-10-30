import { ERROR_CODES, inboxContract } from "@workspace/domain"

import { bindCommands, tableQuery } from "../registry/bind.js"
import { CommandError } from "../registry/errors.js"
import type { Registry } from "../registry/registry.js"
import { draftWithHint } from "./draft-coach.js"
import {
  addToCalendar,
  clearSuggestion,
  fixtureDraft,
  readInbox,
  readSnoozedInbox,
  readInboxThread,
  scanInbox,
  sendReply,
  setThreadStatus,
  skipInbox,
  updateDraft,
} from "./store.js"

let commandsAdded = false

export function registerInbox(registry: Registry) {
  if (commandsAdded) return
  commandsAdded = true

  bindCommands(registry, inboxContract, {
    "inbox.skip": {
      handler: (_input, actor) => skipInbox(actor),
      reversal: () => null,
      activity: () => null,
    },
    "inbox.scan": {
      handler: (_input, actor) => scanInbox(actor),
      reversal: () => null,
      activity: () => null,
    },
    "inbox.markDone": {
      handler: (input, actor) =>
        setThreadStatus(actor, input.threadId, input.status ?? "done", null),
      reversal: (input, output) => ({
        command: "inbox.markDone",
        input: { threadId: input.threadId, status: output.previousStatus },
      }),
      activity: (input) => ({
        subjectKind: "inbox",
        subjectId: input.threadId,
        summary: "Marked the email done",
      }),
    },
    "inbox.snooze": {
      handler: (input, actor) => {
        const until = input.until == null ? null : new Date(input.until)
        return setThreadStatus(
          actor,
          input.threadId,
          until ? "snoozed" : "open",
          until
        )
      },
      reversal: (input, output) => ({
        command: "inbox.snooze",
        input: {
          threadId: input.threadId,
          until: output.previousSnoozeUntil,
        },
      }),
      activity: (input) => ({
        subjectKind: "inbox",
        subjectId: input.threadId,
        summary: "Snoozed the email",
      }),
    },
    "inbox.clearSuggestion": {
      handler: (input, actor) => clearSuggestion(actor, input.threadId),
      reversal: () => null,
      activity: () => null,
    },
    "inbox.acceptSuggestion": {
      handler: async (input, actor) => {
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
      },
      reversal: () => null,
      activity: () => null,
    },
    "inbox.draftReply": {
      handler: (input, actor) =>
        input.hint
          ? draftWithHint(registry, actor, input.threadId, input.hint)
          : fixtureDraft(actor, input.threadId),
      reversal: () => null,
      activity: () => null,
    },
    "inbox.updateDraft": {
      handler: (input, actor) => updateDraft(actor, input.threadId, input.body),
      reversal: () => null,
      activity: () => null,
    },
    "inbox.send": {
      handler: (input, actor) => sendReply(actor, input.threadId),
      reversal: () => null,
      activity: () => null,
    },
    "inbox.addToCalendar": {
      handler: (input, actor) =>
        addToCalendar(actor, input.threadId, input.start),
      reversal: () => null,
      activity: () => null,
    },
  })

  registry.addQuery(
    tableQuery("inbox.list", {
      description: "List email threads.",
      coach: false,
      step: () => "List email threads",
      read: (_input, actor) => readInbox(actor.userId),
    })
  )

  registry.addQuery(
    tableQuery("inbox.snoozed", {
      description: "List snoozed email threads.",
      coach: false,
      step: () => "List snoozed email threads",
      read: (_input, actor) => readSnoozedInbox(actor.userId),
    })
  )

  registry.addQuery(
    tableQuery("inbox.get", {
      description: "Read one email thread.",
      coach: false,
      step: () => "Read the email thread",
      read: (input, actor) => readInboxThread(actor.userId, input.threadId),
    })
  )
}
