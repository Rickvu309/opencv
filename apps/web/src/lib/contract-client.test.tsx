import { undoneActivityRow } from "@/test/control-fixtures.ts"
import { QueryClient } from "@tanstack/react-query"
import {
  emptyRichPaper,
  nativeProvenance,
  parseChatId,
  parseJobId,
  parsePaperId,
  RICH_NATIVE_WRITER,
} from "@workspace/domain"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  catalogClient,
  queryKey,
  refreshReads,
  runContractCommand,
  undoActivity,
} from "./contract-client.ts"

const JOB = parseJobId("01900000-0000-7000-8000-000000000010")
const OTHER = parseJobId("01900000-0000-7000-8000-000000000011")
const DOC = parsePaperId("01900000-0000-7000-8000-000000000012")

function jobActivity(queryClient: QueryClient) {
  const read = catalogClient.options("owner", "activity.list", {
    subjectKind: "job",
    subjectId: JOB,
  })
  queryClient.getQueryCache().build(queryClient, read)
  return read.queryKey
}

function built(
  queryClient: QueryClient,
  read: ReturnType<typeof catalogClient.options>
) {
  queryClient.getQueryCache().build(queryClient, read as never)
  return read.queryKey
}

function seed(queryClient: QueryClient) {
  const keys = {
    list: built(queryClient, catalogClient.options("owner", "job.list", {})),
    mine: built(
      queryClient,
      catalogClient.options("owner", "job.get", { jobId: JOB })
    ),
    other: built(
      queryClient,
      catalogClient.options("owner", "job.get", { jobId: OTHER })
    ),
    activity: jobActivity(queryClient),
    paper: queryKey({ query: "paper.list" }),
    outline: queryKey({ query: "paper.outline", input: { docId: DOC } }),
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

  it("refreshes the reads paper.canvas invalidates and nothing else", async () => {
    const queryClient = new QueryClient()
    const keys = seed(queryClient)
    stubFetch({ id: DOC })

    await runContractCommand(queryClient, "paper.canvas", {
      op: "mint",
      label: "cv",
    })

    expect(isStale(queryClient, keys.list)).toBe(true)
    expect(isStale(queryClient, keys.mine)).toBe(true)
    expect(isStale(queryClient, keys.activity)).toBe(true)
    expect(isStale(queryClient, keys.other)).toBe(true)
    expect(isStale(queryClient, keys.paper)).toBe(true)
    expect(isStale(queryClient, keys.outline)).toBe(false)
  })

  it("sends the input with a fresh idempotency key per call", async () => {
    const queryClient = new QueryClient()
    const bodies = stubFetch({ id: JOB })
    const input = { op: "mint", label: "cv" } as const

    await runContractCommand(queryClient, "paper.canvas", input)
    await runContractCommand(queryClient, "paper.canvas", input)

    const [first, second] = bodies as {
      input: unknown
      idempotencyKey: string
    }[]
    expect(first.input).toEqual(input)
    expect(first.idempotencyKey).toEqual(expect.any(String))
    expect(second.idempotencyKey).not.toBe(first.idempotencyKey)
  })

  it("takes the idempotency key from the contract entry, not the call site", async () => {
    const queryClient = new QueryClient()
    const provenance = nativeProvenance(emptyRichPaper("cv"))
    const bodies = stubFetch({
      provenance,
      epoch: 1,
      revision: 0,
      reset: false,
      stale: false,
      update: "",
      stateVector: "",
    }) as Record<string, unknown>[]

    await catalogClient.run(queryClient, "paper.save", {
      docId: parsePaperId("01900000-0000-7000-8000-000000000020"),
      writer: RICH_NATIVE_WRITER,
      provenance,
      epoch: 0,
      update: "",
      stateVector: "",
    })
    await runContractCommand(queryClient, "paper.canvas", {
      op: "mint",
      label: "cv",
    })

    expect(bodies[0]).not.toHaveProperty("idempotencyKey")
    expect(bodies[1]).toHaveProperty("idempotencyKey")
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
      runContractCommand(queryClient, "paper.canvas", {
        op: "mint",
        label: "cv",
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
      queryKey({ query: "paper.read", input: { docId: "doc-1" } }),
      queryKey({ query: "inbox.get", input: { id: "mail-1" } }),
      queryKey({ query: "chat.get", input: { chatId } }),
      jobActivity(queryClient),
    ]
    for (const key of refreshed) queryClient.setQueryData(key, { seeded: true })
    stubFetch(undoneActivityRow(activityId))

    await undoActivity(queryClient, activityId)

    for (const key of refreshed) {
      expect(isStale(queryClient, key), JSON.stringify(key)).toBe(true)
    }
  })
})

describe("refreshReads", () => {
  it("refreshes only the reads it names, never the activity root", async () => {
    const queryClient = new QueryClient()
    const keys = seed(queryClient)

    await refreshReads(queryClient, [{ query: "paper.list" }])

    expect(isStale(queryClient, keys.paper)).toBe(true)
    expect(isStale(queryClient, keys.activity)).toBe(false)
  })
})
