import { QueryClient } from "@tanstack/react-query"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  billingKey,
  integrationsKey,
  profileKey,
  usageKey,
} from "./account-api.ts"
import { runContractCommand } from "./contract-client.ts"

const isStale = (queryClient: QueryClient, key: readonly unknown[]) =>
  queryClient.getQueryState(key)?.isInvalidated

describe("account reads", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("refreshes the one profile key, billing and usage after a profile write", async () => {
    const queryClient = new QueryClient()
    const keys = [profileKey(), billingKey(), usageKey(), integrationsKey()]
    for (const key of keys) queryClient.setQueryData(key, { seeded: true })
    vi.stubGlobal("fetch", async () =>
      Response.json({ ok: true, data: { id: "u1" } })
    )

    await runContractCommand(queryClient, "profile.update", {
      coachMode: "light",
    })

    expect(isStale(queryClient, profileKey())).toBe(true)
    expect(isStale(queryClient, billingKey())).toBe(true)
    expect(isStale(queryClient, usageKey())).toBe(true)
    expect(isStale(queryClient, integrationsKey())).toBe(false)
  })

  it("leaves the profile alone after a notify request", async () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(profileKey(), { seeded: true })
    vi.stubGlobal("fetch", async () =>
      Response.json({ ok: true, data: { id: "n1" } })
    )

    await runContractCommand(queryClient, "notify.request", { topic: "jobs" })

    expect(isStale(queryClient, profileKey())).toBe(false)
  })
})
