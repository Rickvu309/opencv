import {
  inboxStatusChangeSchema,
  type InboxStatusChange,
} from "@workspace/domain"
import { operation } from "@workspace/domain/operations/inbox/mark-done"
import type { OperationBinding } from "../../../registry/bind.js"
import { setThreadStatus } from "../../store.js"

export const implementation = {
  operation,
  privateResult: inboxStatusChangeSchema,
  execute: (input, actor) =>
    setThreadStatus(actor, input.threadId, input.status ?? "done", null),
  reversal: (input, result) => ({
    command: operation.name,
    input: { threadId: input.threadId, status: result.previousStatus },
    expect: {
      query: "inbox.get",
      input: { threadId: input.threadId },
      matches: { status: input.status ?? "done" },
      skipped: "This email moved again, so Undo was skipped",
    },
  }),
  activity: (input) => ({
    subjectKind: "inbox",
    subjectId: input.threadId,
    summary: "Marked the email done",
  }),
} satisfies OperationBinding<typeof operation, InboxStatusChange>
