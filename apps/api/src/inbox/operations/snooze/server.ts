import {
  inboxStatusChangeSchema,
  type InboxStatusChange,
} from "@workspace/domain/inbox"
import { operation } from "@workspace/domain/operations/inbox/snooze"
import type { OperationBinding } from "../../../registry/bind.js"
import { setThreadStatus } from "../../store.js"

const statusAfter = (until: string | null) => (until ? "snoozed" : "open")

export const implementation = {
  operation,
  privateResult: inboxStatusChangeSchema,
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
      skipped: "This email moved again, so Undo was skipped",
    },
  }),
  activity: (input) => ({
    subjectKind: "inbox",
    subjectId: input.threadId,
    summary: "Snoozed the email",
  }),
} satisfies OperationBinding<typeof operation, InboxStatusChange>
