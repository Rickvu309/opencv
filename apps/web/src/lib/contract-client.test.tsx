import { QueryClient } from "@tanstack/react-query"
import { parseChatId, parseJobId } from "@workspace/domain"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  activityKey,
  queryKey,
  runContractCommand,
  undoActivity,
} from "./contract-client.ts"

const JOB = parseJobId("01900000-0000-7000-8000-000000000010")
const OTHER = parseJobId("01900000-0000-7000-8000-000000000011")

function seed(queryClient: QueryClient) {
  const keys = {
    list: queryKey({ query: "job.list" }),
    mine: queryKey({ query: "job.get", input: { jobId: JOB } }),
    other: queryKey({ query: "job.get", input: { jobId: OTHER } }),
    activity: activityKey("job", JOB),
    paper: queryKey({ query: "paper.list" }),
  }
  for (const key of Object.values(keys)) {
    queryClient.setQueryData(key, { seeded: true })
  }
  return keys
}

function stubFetch(data: unknown) {
  const bodies: unknown[] = []
  vi.stubGlobal("fetch", async (_url: unknown, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)))
    return Response.json({ ok: true, data })
  })
  return bodies
}

const isStale = (queryClient: QueryClient, key: readonly unknown[]) =>
  queryClient.getQueryState(key)?.isInvalidated

describe("runContractCommand", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("refreshes the reads job.move invalidates and nothing else", async () => {
    const queryClient = new QueryClient()
    const keys = seed(queryClient)
    stubFetch({ id: JOB })

    await runContractCommand(queryClient, "job.move", {
      jobId: JOB,
      stage: "applied",
    })

    expect(isStale(queryClient, keys.list)).toBe(true)
    expect(isStale(queryClient, keys.mine)).toBe(true)
    expect(isStale(queryClient, keys.activity)).toBe(true)
    expect(isStale(queryClient, keys.other)).toBe(false)
    expect(isStale(queryClient, keys.paper)).toBe(false)
  })

  it("sends the input with a fresh idempotency key per call", async () => {
    const queryClient = new QueryClient()
    const bodies = stubFetch({ id: JOB })
    const input = { jobId: JOB, stage: "applied" } as const

    await runContractCommand(queryClient, "job.move", input)
    await runContractCommand(queryClient, "job.move", input)

    const [first, second] = bodies as {
      input: unknown
      idempotencyKey: string
    }[]
    expect(first.input).toEqual(input)
    expect(first.idempotencyKey).toEqual(expect.any(String))
    expect(second.idempotencyKey).not.toBe(first.idempotencyKey)
  })

  it("leaves reads alone when the command fails", async () => {
    const queryClient = new QueryClient()
    const keys = seed(queryClient)
    vi.stubGlobal("fetch", async () =>
      Response.json(
        { ok: false, error: { code: "VALIDATION_ERROR", message: "no" } },
        { status: 400 }
      )
    )

    await expect(
      runContractCommand(queryClient, "job.move", {
        jobId: JOB,
        stage: "applied",
      })
    ).rejects.toThrow()

    expect(isStale(queryClient, keys.list)).toBe(false)
  })

  it("refreshes every read an undo may have touched", async () => {
    const queryClient = new QueryClient()
    const chatId = parseChatId("01900000-0000-7000-8000-000000000020")
    const activityId = "01900000-0000-7000-8000-000000000030"
    const refreshed = [
      queryKey({ query: "job.list" }),
      queryKey({ query: "job.get", input: { jobId: JOB } }),
      queryKey({ query: "job.calendar" }),
      queryKey({ query: "paper.list" }),
      queryKey({ query: "paper.get", input: { docId: "doc-1" } }),
      queryKey({ query: "paper.pageCount", input: { docId: "doc-1" } }),
      queryKey({ query: "paper.shared", input: { docId: "doc-1" } }),
      queryKey({ query: "paper.files" }),
      queryKey({ query: "inbox.get", input: { id: "mail-1" } }),
      queryKey({ query: "chat.get", input: { chatId } }),
      activityKey("job", JOB),
    ]
    for (const key of refreshed) queryClient.setQueryData(key, { seeded: true })
    stubFetch({ id: activityId })

    await undoActivity(queryClient, activityId)

    for (const key of refreshed) {
      expect(isStale(queryClient, key), JSON.stringify(key)).toBe(true)
    }
  })
})
