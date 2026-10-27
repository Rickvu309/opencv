import { z } from "zod"

import { queryContract, queryEntry } from "./contract.js"
import { chatDetailSchema, chatListSchema } from "./chat-contract.js"
import { chatIdSchema } from "./ids.js"
import { inboxQueries } from "./inbox-contract.js"
import { jobQueries } from "./job-contract.js"
import { paperQueries } from "./paper-contract.js"

const empty = z.object({}).strict()
// Outputs below stay unknown until the unit that contracts that feature types them.
const untyped = z.unknown()

export const queries = queryContract({
  ...jobQueries,
  ...inboxQueries,
  ...paperQueries,
  "chat.list": queryEntry({
    input: z.object({ query: z.string().optional() }).strict(),
    output: chatListSchema,
  }),
  "chat.get": queryEntry({
    input: z.object({ chatId: chatIdSchema }).strict(),
    output: chatDetailSchema,
  }),
  "link.get": queryEntry({
    input: z.object({ url: z.string().trim().min(1).max(2000) }).strict(),
    output: untyped,
  }),
  "profile.get": queryEntry({ input: empty, output: untyped }),
  "integrations.list": queryEntry({ input: empty, output: untyped }),
  "billing.get": queryEntry({ input: empty, output: untyped }),
  "coach.usage": queryEntry({ input: empty, output: untyped }),
  "workspace.search": queryEntry({
    input: z.object({ query: z.string().trim().min(1).max(200) }).strict(),
    output: untyped,
  }),
})

export type Queries = typeof queries
export type QueryName = keyof Queries & string
export type QueryInput<N extends QueryName> = z.output<Queries[N]["input"]>
export type QueryOutput<N extends QueryName> = z.output<Queries[N]["output"]>

export type QueryRef = {
  [N in QueryName]: { query: N; input?: Partial<QueryInput<N>> }
}[QueryName]

export const QUERY_NAMES = Object.keys(queries) as QueryName[]
