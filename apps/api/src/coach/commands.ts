import { coachTaskContract } from "@workspace/domain"

import { bindCommands, tableQuery } from "../registry/bind.js"
import { hostTaskApprovals } from "../registry/proposal-hosts.js"
import type { Registry } from "../registry/registry.js"
import { getChat, stopChat } from "./chat/index.js"
import { readTaskEvents, taskSnapshot } from "./task-reader.js"
import { hostedTaskApproval } from "./task-approval.js"
import { startTask } from "./task-start.js"
import { cancelChatTask } from "./task-store.js"

export function registerCoachTasks(registry: Registry) {
  hostTaskApprovals(hostedTaskApproval)
  bindCommands(registry, coachTaskContract, {
    "coach.start": {
      handler: (input, actor) => startTask(input, actor, registry),
      reversal: () => null,
      activity: () => null,
    },
    "coach.stop": {
      handler: async (input, actor) => {
        await getChat(actor.userId, input.chatId)
        if (input.taskId)
          return {
            stopped: await cancelChatTask(
              input.chatId,
              actor.userId,
              input.taskId
            ),
          }
        return {
          stopped:
            (await cancelChatTask(input.chatId, actor.userId)) ||
            stopChat(input.chatId),
        }
      },
      reversal: () => null,
      activity: () => null,
    },
  })
  registry.addQuery(
    tableQuery("coach.status", {
      description: "Read a durable Coach task snapshot and cursor.",
      coach: false,
      step: () => "Read Coach status",
      read: (input, actor) => taskSnapshot(input.taskId, actor.userId),
    })
  )
  registry.addQuery(
    tableQuery("coach.events", {
      description: "Read ordered Coach task events after a cursor.",
      coach: false,
      step: () => "Read Coach events",
      read: (input, actor) =>
        readTaskEvents(input.taskId, actor.userId, input.after),
    })
  )
}
