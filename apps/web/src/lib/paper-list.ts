import { catalog } from "@workspace/domain/kernel"
import {
  type NativeWriter,
  type PaperStoredKind,
  type PaperView,
} from "@workspace/domain/paper-doc"

import { catalogClient } from "./contract-client.ts"

export async function readPaperList(
  input: { writer?: NativeWriter; kind?: PaperStoredKind } = {},
  options: { signal?: AbortSignal } = {}
): Promise<PaperView[]> {
  const rows: unknown = await catalogClient.read(
    catalog["paper.list"].name,
    input,
    options
  )
  return rows as PaperView[]
}

export function paperListQuery(
  ownerId: string,
  input: { writer?: NativeWriter } = {}
) {
  const read = catalogClient.options(ownerId, catalog["paper.list"].name, input)
  return {
    queryKey: read.queryKey,
    meta: read.meta,
    queryFn: (context?: { signal?: AbortSignal }) =>
      readPaperList(input, context?.signal ? { signal: context.signal } : {}),
  }
}
