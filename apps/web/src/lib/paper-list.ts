import type { QueryClient } from "@tanstack/react-query"

import { catalog } from "@workspace/domain/kernel"
import {
  type PaperStoredKind,
  type PaperView,
} from "@workspace/domain/paper-doc"

import { catalogClient } from "./contract-client.ts"

export async function readPaperList(
  input: { kind?: PaperStoredKind } = {},
  options: { signal?: AbortSignal } = {}
): Promise<PaperView[]> {
  const rows: unknown = await catalogClient.read(
    catalog["paper.list"].name,
    input,
    options
  )
  return rows as PaperView[]
}

export function paperListQuery(ownerId: string) {
  const read = catalogClient.options(ownerId, catalog["paper.list"].name, {})
  return {
    queryKey: read.queryKey,
    meta: read.meta,
    queryFn: (context?: { signal?: AbortSignal }) =>
      readPaperList({}, context?.signal ? { signal: context.signal } : {}),
  }
}

export function startPaperLibraryRead(
  queryClient: QueryClient,
  ownerId: string,
  onRows: (rows: readonly PaperView[]) => void
) {
  if (!ownerId) return
  const query = paperListQuery(ownerId)
  void queryClient.prefetchQuery(query).then(() => {
    const rows = queryClient.getQueryData<PaperView[]>(query.queryKey)
    if (rows) onRows(rows)
  })
}
