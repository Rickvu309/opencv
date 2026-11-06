import { coachTaskContract } from "@workspace/domain"
import { bindCommands, tableQuery } from "./bind.js"
import type { Registry } from "./registry.js"

export function registerCoachTasks(registry: Registry) {
  bindCommands(registry, coachTaskContract, {
    "coach.start": {
      handler: async (input, actor) => {
        const { startTask } = await import("../coach/index.js")
        return startTask(input, actor, registry)
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
      read: async (input, actor) => {
        const { taskSnapshot } = await import("../coach/index.js")
        return taskSnapshot(input.taskId, actor.userId)
      },
    })
  )
  registry.addQuery(
    tableQuery("coach.events", {
      description: "Read ordered Coach task events after a cursor.",
      coach: false,
      step: () => "Read Coach events",
      read: async (input, actor) => {
        const { readTaskEvents } = await import("../coach/index.js")
        return readTaskEvents(input.taskId, actor.userId, input.after)
      },
    })
  )
}
