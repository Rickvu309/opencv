import { QueryClient, QueryObserver } from "@tanstack/react-query"
import { describe, expect, it } from "vitest"

import { profileKey } from "@/lib/account-api.ts"
import { createQueryClient } from "@/lib/query-client.ts"

async function profileReadsWhileOpening(client: QueryClient) {
  let reads = 0
  const queryFn = async () => {
    reads += 1
    return { name: "Ada" }
  }
  const readers = ["shell profile", "Coach mode", "settings nav", "page"]
  for (const reader of readers) {
    const observer = new QueryObserver(client, {
      queryKey: profileKey(),
      queryFn,
      meta: { reader },
    })
    const stop = observer.subscribe(() => undefined)
    await client.getQueryCache().find({ queryKey: profileKey() })?.promise
    await Promise.resolve()
    stop()
  }
  return { reads }
}

describe("createQueryClient", () => {
  it("reads the profile once while every part of a screen that shows it mounts", async () => {
    expect((await profileReadsWhileOpening(createQueryClient())).reads).toBe(1)
  })

  it("reads it again when a command marks the profile changed", async () => {
    const client = createQueryClient()
    let reads = 0
    const observer = new QueryObserver(client, {
      queryKey: profileKey(),
      queryFn: async () => {
        reads += 1
        return { name: "Ada" }
      },
    })
    const stop = observer.subscribe(() => undefined)
    await client.getQueryCache().find({ queryKey: profileKey() })?.promise
    await client.invalidateQueries({ queryKey: profileKey() })
    stop()
    expect(reads).toBe(2)
  })

  it("flags a client that re-reads the profile for every part that mounts", async () => {
    const bare = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    expect((await profileReadsWhileOpening(bare)).reads).toBe(4)
  })
})
