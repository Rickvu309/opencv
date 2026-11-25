import { operation } from "@workspace/domain/operations/chat/rename"
import { z } from "zod"
import type { OperationBinding } from "../../../../registry/bind.js"
import { renameChat } from "../../../chat/index.js"

const privateResult = operation.publicResult
  .extend({ previousTitle: z.string() })
  .strict()

export const implementation = {
  operation,
  privateResult,
  execute: (input, actor) => renameChat(actor, input.chatId, input.title),
  reversal: (input, result) => ({
    command: operation.name,
    input: { chatId: input.chatId, title: result.previousTitle },
    expect: {
      query: "chat.get",
      input: { chatId: input.chatId },
      matches: { title: result.title },
      skipped: "This chat was renamed again, so Undo was skipped",
    },
  }),
  activity: (input) => ({
    subjectKind: "chat",
    subjectId: input.chatId,
    summary: `You renamed the chat to ${input.title}`,
  }),
} satisfies OperationBinding<typeof operation, z.output<typeof privateResult>>
