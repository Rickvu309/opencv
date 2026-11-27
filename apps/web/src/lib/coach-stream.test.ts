import type { QueryCache } from "@tanstack/react-query"
import { QueryClient, QueryObserver } from "@tanstack/react-query"
import { parseJobId } from "@workspace/domain/kernel"
import { afterEach, describe, expect, it, vi } from "vitest"
import { paperListQuery } from "./paper-list.ts"

type BuiltQuery = Parameters<QueryCache["build"]>[1]

import { streamChatTurn } from "./coach-stream.ts"
import { authClient } from "./auth-client.ts"
import { catalogClient, queryKey } from "./contract-client.ts"

const JOB = parseJobId("01900000-0000-7000-8000-000000000010")

function sse(...events: [string, unknown][]) {
  return events
    .map(([name, data]) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`)
    .join("")
}

function stubTurn(body: string) {
  vi.stubGlobal("fetch", async () => new Response(body, { status: 200 }))
}

const isStale = (queryClient: QueryClient, key: readonly unknown[]) =>
  queryClient.getQueryState(key)?.isInvalidated

const ok = { ok: true, data: {} }

afterEach(() => vi.unstubAllGlobals())

describe("streamChatTurn", () => {
  it("refreshes the final remaining turn when Stop precedes the usage event", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    })
    const key = queryKey({ query: "coach.usage" })
    let remaining = 1
    const queryFn = async () => ({ day: { capped: true, remaining } })
    await queryClient.fetchQuery({ queryKey: key, queryFn })
    const observer = new QueryObserver(queryClient, { queryKey: key, queryFn })
    const unsubscribe = observer.subscribe(() => {})
    const controller = new AbortController()
    vi.stubGlobal("fetch", async () => {
      remaining = 0
      return new Response(sse(["text-delta", { text: "Partial reply" }]))
    })
    try {
      await streamChatTurn({
        queryClient,
        chatId: "c",
        body: { text: "Hello" },
        signal: controller.signal,
        onEvent: () => controller.abort(),
      }).catch((error: unknown) => {
        expect(error).toMatchObject({ name: "AbortError" })
      })
      await vi.waitFor(() =>
        expect(queryClient.getQueryData(key)).toEqual({
          day: { capped: true, remaining: 0 },
        })
      )
    } finally {
      unsubscribe()
    }
  })

  it("refreshes the Apply reads and not the Paper list when the Coach moves a job", async () => {
    const queryClient = new QueryClient()
    const session = authClient.$store.atoms.session
    authClient.$store.atoms.session = {
      get: () => ({ data: { user: { id: "owner" } } }),
    } as never
    const listRead = catalogClient.options("owner", "job.list", {})
    queryClient.getQueryCache().build(queryClient, listRead as BuiltQuery)
    const list = listRead.queryKey
    const paperRead = paperListQuery("owner")
    queryClient.getQueryCache().build(queryClient, paperRead as BuiltQuery)
    const paper = paperRead.queryKey
    queryClient.setQueryData(list, [])
    queryClient.setQueryData(paper, [])
    stubTurn(
      sse(
        ["message-start", { chatId: "c" }],
        [
          "tool-call",
          {
            toolCallId: "t1",
            name: "job.move",
            input: { jobId: JOB, stage: "applied" },
          },
        ],
        [
          "tool-result",
          {
            toolCallId: "t1",
            name: "job.move",
            summary: "Moved",
            ok: true,
            result: ok,
          },
        ],
        ["message-end", { chatId: "c" }]
      )
    )

    const seen: string[] = []
    await streamChatTurn({
      queryClient,
      chatId: "c",
      body: { text: "move it" },
      onEvent: (event) => seen.push(event.type),
    })
    authClient.$store.atoms.session = session

    expect(seen).toEqual([
      "message-start",
      "tool-call",
      "tool-result",
      "message-end",
    ])
    expect(isStale(queryClient, list)).toBe(true)
    expect(isStale(queryClient, paper)).toBe(false)
  })

  it("refreshes nothing for a read-only tool and skips events the contract does not describe", async () => {
    const queryClient = new QueryClient()
    const list = queryKey({ query: "job.list" })
    queryClient.setQueryData(list, [])
    stubTurn(
      sse(
        ["tool-call", { toolCallId: "t1", name: "job.list", input: {} }],
        [
          "tool-result",
          {
            toolCallId: "t1",
            name: "job.list",
            summary: "Listed",
            ok: true,
            result: ok,
          },
        ],
        ["tool-result", { name: "paper_edit" }],
        ["from-the-future", { anything: 1 }]
      )
    )

    const seen: string[] = []
    await streamChatTurn({
      queryClient,
      chatId: "c",
      body: {},
      onEvent: (event) => seen.push(event.type),
    })

    expect(seen).toEqual(["tool-call", "tool-result"])
    expect(isStale(queryClient, list)).toBeFalsy()
  })

  it("refreshes nothing for a failed tool or a result with no tool-call before it", async () => {
    const queryClient = new QueryClient()
    const list = queryKey({ query: "job.list" })
    queryClient.setQueryData(list, [])
    const moved = {
      toolCallId: "t1",
      name: "job.move",
      summary: "Moved",
      result: ok,
    }
    stubTurn(
      sse(
        [
          "tool-call",
          {
            toolCallId: "t1",
            name: "job.move",
            input: { jobId: JOB, stage: "applied" },
          },
        ],
        ["tool-result", { ...moved, ok: false }],
        ["tool-result", { ...moved, toolCallId: "t2", ok: true }]
      )
    )

    const seen: string[] = []
    await streamChatTurn({
      queryClient,
      chatId: "c",
      body: {},
      onEvent: (event) => seen.push(event.type),
    })

    expect(seen).toEqual(["tool-call", "tool-result", "tool-result"])
    expect(isStale(queryClient, list)).toBeFalsy()
  })
})
