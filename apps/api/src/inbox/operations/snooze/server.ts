import { operation } from "@workspace/domain/operations/inbox/snooze"
import type { OperationBinding } from "../../../registry/bind.js"
import { setThreadStatus } from "../../store.js"
import {
  EMAIL_MOVED_SINCE,
  threadStatusResult,
  type ThreadStatusResult,
} from "../../thread-status.js"

const statusAfter = (until: string | null) => (until ? "snoozed" : "open")

export const implementation = {
  operation,
  privateResult: threadStatusResult,
  execute: (input, actor) =>
    setThreadStatus(
      actor,
      input.threadId,
      statusAfter(input.until),
      input.until == null ? null : new Date(input.until)
    ),
  reversal: (input, result) => ({
    command: operation.name,
    input: { threadId: input.threadId, until: result.previousSnoozeUntil },
    expect: {
      query: "inbox.get",
      input: { threadId: input.threadId },
      matches: { status: statusAfter(input.until) },
      skipped: EMAIL_MOVED_SINCE,
    },
  }),
  activity: (input) => ({
    subjectKind: "inbox",
    subjectId: input.threadId,
    summary: "Snoozed the email",
  }),
} satisfies OperationBinding<typeof operation, ThreadStatusResult>
