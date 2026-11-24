import { coachTaskContract } from "@workspace/domain"

import { bindCommands, tableQuery } from "../registry/bind.js"
import type { Registry } from "../registry/registry.js"
import { readTaskEvents, taskSnapshot } from "./task-reader.js"
import { startTask } from "./task-start.js"

export function registerCoachTasks(registry: Registry) {
  bindCommands(registry, coachTaskContract, {
    "coach.start": {
      handler: (input, actor) => startTask(input, actor, registry),
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
