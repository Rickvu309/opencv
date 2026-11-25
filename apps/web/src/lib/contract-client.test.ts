import {
  QueryClient,
  QueryClientProvider,
  QueryObserver,
} from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import { defineOperation, resourcesOverlap } from "@workspace/domain"
import { createElement, type PropsWithChildren } from "react"
import { afterEach, expect, expectTypeOf, it, vi } from "vitest"
import { z } from "@workspace/domain"
import { createCatalogClient, runContractCommand } from "./contract-client.ts"

const read = defineOperation({
  owner: "job",
  name: "job.list",
  version: 1,
  kind: "read",
  description: "Read fixture",
  input: z.object({
    entityId: z.string().optional(),
    limit: z.number().default(10),
  }),
  publicResult: z.object({ count: z.number() }),
  coach: "auto",
  dependsOn: (input) => [
    {
      name: "fixture.value",
      coachFloor: "auto",
      ...(input.entityId ? { entityId: input.entityId } : {}),
    },
  ],
})
const write = defineOperation({
  owner: "job",
  name: "job.create",
  version: 1,
  kind: "command",
  description: "Write fixture",
  input: z.object({ value: z.number() }),
  publicResult: z.object({ count: z.number() }),
  coach: "auto",
  destructive: false,
  idempotency: "keyed",
  writes: () => [{ name: "fixture.value", coachFloor: "auto" }],
})
const catalog = createCatalogClient({ [read.name]: read, [write.name]: write })

afterEach(() => {
  vi.unstubAllGlobals()
})

it("infers normalized owner-scoped keys, query output and hook output from declarations", async () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const fetch = vi
    .fn()
    .mockResolvedValue(
      Response.json({ ok: true, data: { count: 3, private: "hidden" } })
    )
  vi.stubGlobal("fetch", fetch)
  const key = catalog.key("owner", "job.list", {})
  expectTypeOf(key).toEqualTypeOf<
    readonly [
      "catalog",
      string,
      "job.list",
      { limit: number; entityId?: string },
    ]
  >()
  expect(key).toEqual(["catalog", "owner", "job.list", { limit: 10 }])
  expect(catalog.key("other", "job.list", {})).not.toEqual(key)
  const wrapper = ({ children }: PropsWithChildren) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
  const { result, unmount } = renderHook(
    () => catalog.useRead("owner", "job.list", {}),
    { wrapper }
  )
  expectTypeOf(result.current.data).toEqualTypeOf<
    { count: number } | undefined
  >()
  await waitFor(() => expect(result.current.data).toEqual({ count: 3 }))
  expect(String(fetch.mock.calls[0]?.[0])).toContain("/api/reads/job.list")
  expect(fetch.mock.calls[0]?.[1]).toMatchObject({ method: "POST", body: "{}" })
  unmount()
  queryClient.clear()
})

it("intersects committed touches with mounted collection and entity dependencies and refreshes legacy reads", async () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  let count = 0
  const touches = [{ ownerId: "owner", name: "fixture.value", entityId: "new" }]
  const fetch = vi.fn(async (url: string) => {
    if (String(url).includes("/api/commands/")) {
      count++
      return Response.json({
        ok: true,
        data: { count, activityId: "activity" },
        meta: { touches },
      })
    }
    return Response.json({ ok: true, data: { count } })
  })
  vi.stubGlobal("fetch", fetch)
  const options = [
    catalog.options("owner", "job.list", {}),
    catalog.options("owner", "job.list", { entityId: "new" }),
    catalog.options("owner", "job.list", { entityId: "other" }),
    catalog.options("foreign", "job.list", {}),
  ]
  for (const option of options) await queryClient.fetchQuery(option)
  const legacy = {
    queryKey: ["job.get", "legacy"],
    queryFn: vi.fn(async () => count),
  }
  await queryClient.fetchQuery(legacy)
  const stops = [
    ...options.map((option) =>
      new QueryObserver(queryClient, option).subscribe(() => {})
    ),
    new QueryObserver(queryClient, legacy).subscribe(() => {}),
  ]
  expect(await catalog.run(queryClient, "job.create", { value: 1 })).toEqual({
    count: 1,
    activityId: "activity",
  })
  expect(
    options.map((option) => queryClient.getQueryData(option.queryKey))
  ).toEqual([{ count: 1 }, { count: 1 }, { count: 0 }, { count: 0 }])
  expect(legacy.queryFn).toHaveBeenCalledTimes(2)
  for (const stop of stops) stop()
  queryClient.clear()
})

it("bridges legacy workspace touches without treating a proposal or failed request as a write", async () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  const options = [
    catalog.options("owner", "job.list", {}),
    catalog.options("other", "job.list", {}),
  ]
  for (const option of options)
    queryClient.setQueryData(option.queryKey, { count: 0 })
  for (const option of options) new QueryObserver(queryClient, option).destroy()
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(() =>
      Promise.resolve(
        Response.json({
          ok: true,
          data: { title: "Legacy" },
          meta: { touches: [{ ownerId: "owner", name: "workspace" }] },
        })
      )
    )
  )
  await runContractCommand(queryClient, "paper.deleteFile", { stage: "Legacy" })
  expect(
    options.map(
      (option) => queryClient.getQueryState(option.queryKey)?.isInvalidated
    )
  ).toEqual([true, false])
  const invalidate = vi.spyOn(queryClient, "invalidateQueries")
  invalidate.mockClear()
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(() =>
      Promise.resolve(
        Response.json({
          ok: true,
          data: {
            pending: true,
            pendingActionId: "proposal",
            activityId: null,
            reversal: null,
          },
        })
      )
    )
  )
  expect(
    await catalog.run(queryClient, "job.create", { value: 2 })
  ).toMatchObject({ pending: true })
  await runContractCommand(queryClient, "paper.deleteFile", { stage: "Any" })
  expect(invalidate).not.toHaveBeenCalled()
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json(
          { ok: false, error: { code: "FORBIDDEN", message: "Denied" } },
          { status: 403 }
        )
      )
  )
  await expect(
    catalog.run(queryClient, "job.create", { value: 2 })
  ).rejects.toThrow("Denied")
  expect(invalidate).not.toHaveBeenCalled()
  queryClient.clear()
})

it("matches collections, entities, owner workspace and owner isolation with pure resources", () => {
  const entity = { ownerId: "ada", name: "fixture.priority", entityId: "a" }
  expect(resourcesOverlap(entity, { ...entity })).toBe(true)
  expect(resourcesOverlap(entity, { ...entity, entityId: "b" })).toBe(false)
  expect(
    resourcesOverlap(entity, { ownerId: "ada", name: "fixture.priority" })
  ).toBe(true)
  expect(resourcesOverlap(entity, { ownerId: "ada", name: "workspace" })).toBe(
    true
  )
  expect(resourcesOverlap(entity, { ...entity, ownerId: "bea" })).toBe(false)
  expect(resourcesOverlap(entity, { ...entity, name: "fixture.other" })).toBe(
    false
  )
})

it("replays an explicit original command key and keeps generated keys fresh for changed input", async () => {
  const queryClient = new QueryClient()
  const bodies: { input: unknown; idempotencyKey?: string }[] = []
  const receipts = new Map<string, { id: string }>()
  vi.stubGlobal(
    "fetch",
    vi.fn((_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as {
        input: unknown
        idempotencyKey: string
      }
      bodies.push(body)
      const receipt = receipts.get(body.idempotencyKey) ?? {
        id: crypto.randomUUID(),
      }
      receipts.set(body.idempotencyKey, receipt)
      return Promise.resolve(Response.json({ ok: true, data: receipt }))
    })
  )
  const idempotencyKey = crypto.randomUUID()
  const original = await runContractCommand(
    queryClient,
    "paper.deleteFile",
    { stage: "Original" },
    { refresh: false, idempotencyKey }
  )
  const replay = await runContractCommand(
    queryClient,
    "paper.deleteFile",
    { stage: "Original" },
    { refresh: false, idempotencyKey }
  )
  await runContractCommand(
    queryClient,
    "paper.deleteFile",
    { stage: "Changed" },
    { refresh: false }
  )
  await runContractCommand(
    queryClient,
    "paper.deleteFile",
    { stage: "Changed again" },
    { refresh: false }
  )
  expect(replay).toEqual(original)
  expect(bodies[1]).toEqual(bodies[0])
  expect(new Set(bodies.map((body) => body.idempotencyKey)).size).toBe(3)
  expect(bodies[2]?.input).toEqual({ stage: "Changed" })
  queryClient.clear()
})
it("omits even an explicit key for commands whose contract has idempotency none", async () => {
  const queryClient = new QueryClient()
  const fetch = vi.fn().mockResolvedValue(Response.json({ ok: true, data: {} }))
  vi.stubGlobal("fetch", fetch)
  await runContractCommand(queryClient, "paper.save", {} as never, {
    refresh: false,
    idempotencyKey: crypto.randomUUID(),
  })
  expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({
    input: {},
  })
  queryClient.clear()
})
