import { z } from "zod"

import {
  commandContract,
  commandEntry,
  queryContract,
  queryEntry,
} from "./contract.js"
import {
  draftOutput,
  emptyInboxInput,
  inboxDetailSchema,
  inboxListSchema,
  threadIdSchema,
  threadInput,
} from "./inbox.js"
import type { QueryRef } from "./queries.js"

export const inboxQueries = queryContract({
  "inbox.list": queryEntry({ input: emptyInboxInput, output: inboxListSchema }),
  "inbox.snoozed": queryEntry({
    input: emptyInboxInput,
    output: inboxListSchema,
  }),
  "inbox.get": queryEntry({ input: threadInput, output: inboxDetailSchema }),
})

const listChanged = (): QueryRef[] => [
  { query: "inbox.list" },
  { query: "inbox.snoozed" },
]

const threadChanged = (input: { threadId: string }): QueryRef[] => [
  { query: "inbox.get", input: { threadId: input.threadId } },
]

const listAndThreadChanged = (input: { threadId: string }): QueryRef[] => [
  ...listChanged(),
  ...threadChanged(input),
]

export const inboxContract = commandContract({
  "inbox.draftReply": commandEntry({
    description: "Draft a reply. A hint asks the Coach for another one.",
    input: z
      .object({
        threadId: threadIdSchema,
        hint: z.string().trim().min(1).max(8000).optional(),
      })
      .strict(),
    output: draftOutput,
    coach: "auto",
    destructive: false,
    step: () => "Draft a reply",
    invalidates: threadChanged,
  }),
  "inbox.updateDraft": commandEntry({
    description: "Save an edited reply.",
    input: z
      .object({ threadId: threadIdSchema, body: z.string().max(20_000) })
      .strict(),
    output: draftOutput,
    coach: "never",
    destructive: false,
    step: () => "Update the draft",
    invalidates: threadChanged,
  }),
  "inbox.send": commandEntry({
    description: "Send the drafted reply.",
    input: threadInput,
    output: z
      .object({ id: z.string(), threadId: z.string(), body: z.string() })
      .strict(),
    coach: "never",
    destructive: true,
    step: () => "Send the reply",
    invalidates: listAndThreadChanged,
  }),
  "inbox.addToCalendar": commandEntry({
    description: "Add the selected time to the calendar.",
    input: z
      .object({ threadId: threadIdSchema, start: z.string().datetime() })
      .strict(),
    output: z
      .object({
        id: z.string(),
        threadId: z.string(),
        start: z.string().datetime(),
      })
      .strict(),
    coach: "never",
    destructive: false,
    step: () => "Add the time to the calendar",
    invalidates: () => [],
  }),
})

export type InboxContract = typeof inboxContract
