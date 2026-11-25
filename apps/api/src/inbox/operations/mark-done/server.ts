import { operation } from "@workspace/domain/operations/inbox/mark-done"
import type { OperationBinding } from "../../../registry/bind.js"
import { setThreadStatus } from "../../store.js"
import {
  EMAIL_MOVED_SINCE,
  threadStatusResult,
  type ThreadStatusResult,
} from "../../thread-status.js"

export const implementation = {
  operation,
  privateResult: threadStatusResult,
  execute: (input, actor) =>
    setThreadStatus(actor, input.threadId, input.status ?? "done", null),
  reversal: (input, result) => ({
    command: operation.name,
    input: { threadId: input.threadId, status: result.previousStatus },
    expect: {
      query: "inbox.get",
      input: { threadId: input.threadId },
      matches: { status: input.status ?? "done" },
      skipped: EMAIL_MOVED_SINCE,
    },
  }),
  activity: (input) => ({
    subjectKind: "inbox",
    subjectId: input.threadId,
    summary: "Marked the email done",
  }),
} satisfies OperationBinding<typeof operation, ThreadStatusResult>
