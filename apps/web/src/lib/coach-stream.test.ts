import { QueryClient } from "@tanstack/react-query"
import { parseJobId } from "@workspace/domain"
import { afterEach, describe, expect, it, vi } from "vitest"

import { streamChatTurn } from "./coach-stream.ts"
import { queryKey } from "./contract-client.ts"

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
  it("refreshes the Apply reads when the Coach moves a job", async () => {
    const queryClient = new QueryClient()
    const list = queryKey({ query: "job.list" })
    const paper = queryKey({ query: "paper.list" })
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

    expect(seen).toEqual([
      "message-start",
      "tool-call",
      "tool-result",
      "message-end",
    ])
    expect(isStale(queryClient, list)).toBe(true)
    expect(isStale(queryClient, paper)).toBeFalsy()
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
        ["tool-result", { name: "paper_replace" }],
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
})
