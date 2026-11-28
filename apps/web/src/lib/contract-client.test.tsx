import { undoneActivityRow } from "@/test/control-fixtures.ts"
import { QueryClient } from "@tanstack/react-query"
import { parseChatId, parseJobId, parsePaperId } from "@workspace/domain/kernel"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  catalogClient,
  queryKey,
  refreshReads,
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

function stubFetch(...replies: unknown[]) {
  const bodies: unknown[] = []
  vi.stubGlobal("fetch", async (_url: unknown, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)))
    const data = replies[Math.min(bodies.length, replies.length) - 1]
    return Response.json({ ok: true, data })
  })
  return bodies
}

const isStale = (queryClient: QueryClient, key: readonly unknown[]) =>
  queryClient.getQueryState(key)?.isInvalidated

describe("catalogClient.run", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("sends the input with a fresh idempotency key per call", async () => {
    const queryClient = new QueryClient()
    const bodies = stubFetch({ fileId: DOC })
    const input = { fileId: DOC }

    await catalogClient.run(queryClient, "paper.deleteFile", input)
    await catalogClient.run(queryClient, "paper.deleteFile", input)

    const [first, second] = bodies as {
      input: unknown
      idempotencyKey: string
    }[]
    expect(first.input).toEqual(input)
    expect(first.idempotencyKey).toEqual(expect.any(String))
    expect(second.idempotencyKey).not.toBe(first.idempotencyKey)
  })

  it("takes the idempotency key from the operation, not the call site", async () => {
    const queryClient = new QueryClient()
    const bodies = stubFetch({ ok: true, head: 1 }, { fileId: DOC }) as Record<
      string,
      unknown
    >[]

    await catalogClient.run(queryClient, "paper.save", {
      docId: parsePaperId("01900000-0000-7000-8000-000000000020"),
      client: "tab-contract-client",
      base: 0,
      changes: [
        {
          edit: "edit-contract-client",
          origin: {
            kind: "person",
            actor: "person",
            client: "tab-contract-client",
          },
          base: 0,
          steps: [],
          inverse: [],
          commands: [],
        },
      ],
    })
    await catalogClient.run(queryClient, "paper.deleteFile", { fileId: DOC })

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
      catalogClient.run(queryClient, "paper.deleteFile", { fileId: DOC })
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
