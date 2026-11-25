import { inboxContract } from "@workspace/domain"

import { bindCommands, tableQuery } from "../registry/bind.js"
import type { Registry } from "../registry/registry.js"
import { draftWithHint } from "./draft-coach.js"
import {
  addToCalendar,
  fixtureDraft,
  readInbox,
  readSnoozedInbox,
  readInboxThread,
  sendReply,
  updateDraft,
} from "./store.js"

const registeredOn = new WeakSet<Registry>()

export function registerInbox(registry: Registry) {
  if (registeredOn.has(registry)) return
  registeredOn.add(registry)

  bindCommands(registry, inboxContract, {
    "inbox.draftReply": {
      handler: (input, actor) =>
        input.hint
          ? draftWithHint(registry, actor, input.threadId, input.hint)
          : fixtureDraft(actor, input.threadId),
      reversal: () => null,
      activity: () => null,
    },
    "inbox.updateDraft": {
      handler: (input, actor) => updateDraft(actor, input.threadId, input.body),
      reversal: () => null,
      activity: () => null,
    },
    "inbox.send": {
      handler: (input, actor) => sendReply(actor, input.threadId),
      reversal: () => null,
      activity: () => null,
    },
    "inbox.addToCalendar": {
      handler: (input, actor) =>
        addToCalendar(actor, input.threadId, input.start),
      reversal: () => null,
      activity: () => null,
    },
  })

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
