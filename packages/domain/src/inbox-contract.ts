import { queryContract, queryEntry } from "./contract.js"
import {
  emptyInboxInput,
  inboxDetailSchema,
  inboxListSchema,
  threadInput,
} from "./inbox.js"

export const inboxQueries = queryContract({
  "inbox.list": queryEntry({ input: emptyInboxInput, output: inboxListSchema }),
  "inbox.snoozed": queryEntry({
    input: emptyInboxInput,
    output: inboxListSchema,
  }),
  "inbox.get": queryEntry({ input: threadInput, output: inboxDetailSchema }),
})
