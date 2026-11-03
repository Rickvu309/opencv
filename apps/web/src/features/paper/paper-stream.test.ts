import { QueryClient } from "@tanstack/react-query"
import { afterEach, describe, expect, it, vi } from "vitest"

import { streamPaperTurn } from "./paper-api.ts"

function stubTurn(body: string) {
  vi.stubGlobal("fetch", async () => new Response(body, { status: 200 }))
}

const base = {
  chatId: "c",
  text: "Tighten this",
  focusDocId: "d",
}

afterEach(() => vi.unstubAllGlobals())

describe("streamPaperTurn", () => {
  it("reports the text and the tool the Coach ran from the shared contract events", async () => {
    stubTurn(
      [
        'event: text-delta\ndata: {"text":"Tight"}\n\n',
        'event: tool-result\ndata: {"toolCallId":"t","name":"paper.edit","summary":"Saved","ok":true,"result":{"ok":true,"data":{}}}\n\n',
      ].join("")
    )
    const text: string[] = []
    const tools: string[] = []
    await streamPaperTurn({
      ...base,
      queryClient: new QueryClient(),
      onText: (delta) => text.push(delta),
      onToolResult: (name) => tools.push(name),
    })
    expect(text).toEqual(["Tight"])
    expect(tools).toEqual(["paper.edit"])
  })

  it("ignores the old field names the server never sent", async () => {
    stubTurn(
      [
        'event: text-delta\ndata: {"delta":"x"}\n\n',
        'event: tool-result\ndata: {"tool":"paper_edit"}\n\n',
      ].join("")
    )
    const onText = vi.fn()
    const onToolResult = vi.fn()
    await streamPaperTurn({
      ...base,
      queryClient: new QueryClient(),
      onText,
      onToolResult,
    })
    expect(onText).not.toHaveBeenCalled()
    expect(onToolResult).not.toHaveBeenCalled()
  })

  it("throws the Coach error message", async () => {
    stubTurn('event: error\ndata: {"message":"The Coach stopped."}\n\n')
    await expect(
      streamPaperTurn({
        ...base,
        queryClient: new QueryClient(),
        onText: () => undefined,
        onToolResult: () => undefined,
      })
    ).rejects.toThrow("The Coach stopped.")
  })
})
