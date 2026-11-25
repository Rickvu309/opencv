import { z } from "zod"
import { catalog } from "./catalog.js"

import { queryContract, queryEntry } from "./contract.js"
import { paperQueries } from "./paper-doc/paper-contract.js"

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
  ...paperQueries,
  "link.get": queryEntry({
    input: z.object({ url: z.string().trim().min(1).max(2000) }).strict(),
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
