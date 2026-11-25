import { tableQuery } from "../registry/bind.js"
import type { Registry } from "../registry/registry.js"
import { readInbox, readSnoozedInbox, readInboxThread } from "./store.js"

const registeredOn = new WeakSet<Registry>()

export function registerInbox(registry: Registry) {
  if (registeredOn.has(registry)) return
  registeredOn.add(registry)

  registry.addQuery(
    tableQuery("inbox.list", {
      description: "List email threads.",
      coach: false,
      step: () => "List email threads",
      read: (_input, actor) => readInbox(actor.userId),
    })
  )

  registry.addQuery(
    tableQuery("inbox.snoozed", {
      description: "List snoozed email threads.",
      coach: false,
      step: () => "List snoozed email threads",
      read: (_input, actor) => readSnoozedInbox(actor.userId),
    })
  )

  registry.addQuery(
    tableQuery("inbox.get", {
      description: "Read one email thread.",
      coach: false,
      step: () => "Read the email thread",
      read: (input, actor) => readInboxThread(actor.userId, input.threadId),
    })
  )
}
