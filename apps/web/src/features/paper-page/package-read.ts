import { QueryClient } from "@tanstack/react-query"

import { catalogClient } from "@/lib/contract-client.ts"

export type PackageRegion = {
  kind: string
  text: string
  paragraph?: string
  targetId?: string
  reason?: { code: string; message?: string }
  location?: { kind: string }
}

export type PackageRead = {
  revision: string
  regions: PackageRegion[]
  nextCursor: string | null
}

const readers = new QueryClient()

function isPackageRead(value: unknown): value is PackageRead {
  if (!value || typeof value !== "object") return false
  if (!("revision" in value) || typeof value.revision !== "string") return false
  if (!("regions" in value) || !Array.isArray(value.regions)) return false
  const cursor = "nextCursor" in value ? value.nextCursor : null
  return cursor === null || typeof cursor === "string"
}

export async function readWholePackage(
  owner: string,
  docId: string,
  signal: AbortSignal
): Promise<PackageRead | null> {
  const regions: PackageRegion[] = []
  const seen = new Set<string>()
  let cursor: string | undefined
  for (;;) {
    if (signal.aborted) return null
    const options = catalogClient.options(
      owner,
      "paper.read",
      cursor ? { docId, cursor } : { docId }
    )
    if (!options.queryFn) return null
    const data = await options.queryFn({
      client: readers,
      queryKey: options.queryKey,
      signal,
      meta: options.meta,
    })
    if (!isPackageRead(data)) return null
    regions.push(...data.regions)
    if (!data.nextCursor || seen.has(data.nextCursor)) {
      return { ...data, regions, nextCursor: null }
    }
    seen.add(data.nextCursor)
    cursor = data.nextCursor
  }
}
