import type { QueryKey } from "@tanstack/react-query"
import type { QueryCache } from "@tanstack/react-query"
import { QueryClient } from "@tanstack/react-query"
import { afterEach, describe, expect, it, vi } from "vitest"

type BuiltQuery = Parameters<QueryCache["build"]>[1]

import { catalogClient } from "./contract-client.ts"

const savedProfile = {
  id: "u1",
  name: "Ada",
  email: "ada@example.com",
  emailVerified: true,
  image: null,
  plan: "pro",
  coachMode: "light",
  language: "en",
  timeZone: "UTC",
  startPage: "apply",
  notifyEmail: true,
  notifyBrowser: false,
  memoryEnabled: true,
  agentChat: true,
  agentCvs: true,
  agentInterview: true,
  agentEmail: true,
  agentWeekly: false,
  welcomedAt: null,
  inboxSkippedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
}

const isStale = (queryClient: QueryClient, key: readonly unknown[]) =>
  queryClient.getQueryState(key)?.isInvalidated

describe("account reads", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("refreshes the profile, billing, usage and every other older read after a profile write", async () => {
    const queryClient = new QueryClient()
    const billing = catalogClient.options("owner", "billing.get", {})
    const integrations = catalogClient.options("owner", "integrations.list", {})
    const usage = catalogClient.options("owner", "coach.usage", {})
    const profile = catalogClient.options("owner", "profile.get", {})
    for (const read of [billing, integrations, usage, profile])
      queryClient.getQueryCache().build(queryClient, read as BuiltQuery)
    const keys = [
      profile.queryKey,
      billing.queryKey,
      usage.queryKey,
      integrations.queryKey,
    ]
    for (const key of keys)
      queryClient.setQueryData<unknown>(key as QueryKey, { seeded: true })
    vi.stubGlobal("fetch", async () =>
      Response.json({ ok: true, data: savedProfile })
    )

    await catalogClient.run(queryClient, "profile.update", {
      coachMode: "light",
    })

    for (const key of keys) expect(isStale(queryClient, key)).toBe(true)
  })
})
