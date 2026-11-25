import { z } from "zod"
import { catalog } from "./catalog.js"

import { queryContract, queryEntry } from "./contract.js"
import { accountQueries } from "./account-contract.js"
import { chatDetailSchema, chatListSchema } from "./chat-views.js"
import { chatIdSchema } from "./ids.js"
import { jobQueries } from "./job-contract.js"
import { paperQueries } from "./paper-contract.js"

const untyped = z.unknown()

type CatalogReads = {
  [
    N in keyof typeof catalog as (typeof catalog)[N]["kind"] extends "read"
      ? N
      : never
  ]: {
    input: (typeof catalog)[N]["input"]
    output: (typeof catalog)[N]["publicResult"]
  }
}

const catalogReads = Object.fromEntries(
  Object.values(catalog)
    .filter((operation) => operation.kind === "read")
    .map((operation) => [
      operation.name,
      { input: operation.input, output: operation.publicResult },
    ])
) as CatalogReads

export const queries = queryContract({
  ...catalogReads,
  ...jobQueries,
  ...paperQueries,
  ...accountQueries,
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
  "workspace.search": queryEntry({
    input: z.object({ query: z.string().trim().min(1).max(200) }).strict(),
    output: untyped,
  }),
})

type Queries = typeof queries
export type QueryName = keyof Queries & string
export type QueryInput<N extends QueryName> = z.output<Queries[N]["input"]>
export type QueryOutput<N extends QueryName> = z.output<Queries[N]["output"]>

export type QueryRef = {
  [N in QueryName]: { query: N; input?: Partial<QueryInput<N>> }
}[QueryName]
