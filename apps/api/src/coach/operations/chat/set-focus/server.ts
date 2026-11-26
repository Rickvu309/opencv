import { operation } from "@workspace/domain/operations/chat/set-focus"
import { chatFocusSchema } from "@workspace/domain/coach"
import type { z } from "zod"
import type { OperationBinding } from "../../../../registry/bind.js"
import { setChatFocus } from "../../../chat/index.js"

const privateResult = operation.publicResult
  .extend({ previousFocus: chatFocusSchema.nullable() })
  .strict()

export const implementation = {
  operation,
  privateResult,
  execute: (input, actor) => setChatFocus(actor, input),
  reversal: (input, result) => ({
    command: operation.name,
    input: { chatId: input.chatId, focus: result.previousFocus },
    expect: {
      query: "chat.get",
      input: { chatId: input.chatId },
      matches: { focusKind: result.focusKind, focusId: result.focusId },
      skipped: "This chat points somewhere new, so Undo was skipped",
    },
  }),
  activity: (input) => ({
    subjectKind: "chat",
    subjectId: input.chatId,
    summary: input.focus
      ? `You pointed the chat at the ${input.focus.kind}`
      : "You cleared what the chat points at",
  }),
} satisfies OperationBinding<typeof operation, z.output<typeof privateResult>>
