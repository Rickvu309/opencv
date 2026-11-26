import { QueryClient } from "@tanstack/react-query"
import { wordPageSchema, type WordPage } from "@workspace/domain/paper-doc"

import { catalogClient } from "@/lib/contract-client.ts"

const readers = new QueryClient()

export async function readWordPage(
  owner: string,
  docId: string,
  signal: AbortSignal
): Promise<WordPage | null> {
  if (signal.aborted) return null
  const options = catalogClient.options(owner, "paper.read", {
    view: "page",
    docId,
  })
  if (!options.queryFn) return null
  const data = await options.queryFn({
    client: readers,
    queryKey: options.queryKey,
    signal,
    meta: options.meta,
  })
  const page = wordPageSchema.safeParse(data)
  return page.success ? page.data : null
}
