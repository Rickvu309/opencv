import { operation } from "@workspace/domain/operations/coach/stop"
import type { OperationBinding } from "../../../registry/bind.js"
import { getChat, stopChat } from "../../chat/index.js"
import { cancelChatTask } from "../../task-store.js"

export const implementation = {
  operation,
  execute: async (input, actor) => {
    await getChat(actor.userId, input.chatId)
    if (input.taskId)
      return {
        stopped: await cancelChatTask(input.chatId, actor.userId, input.taskId),
      }
    return {
      stopped:
        (await cancelChatTask(input.chatId, actor.userId)) ||
        stopChat(input.chatId),
    }
  },
  reversal: { irreversible: "A stopped reply stays stopped." },
  activity: { silent: "Stopping a reply changes no saved work." },
} satisfies OperationBinding<typeof operation, { stopped: boolean }>
