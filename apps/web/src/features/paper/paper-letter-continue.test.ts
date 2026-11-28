import { afterEach, expect, it, vi } from "vitest"
import { QueryClient } from "@tanstack/react-query"

import { redraftStoppedLetter } from "./paper-letter-continue.ts"

const DOC = "11111111-1111-4111-8111-111111111111"

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

function generatedResponse() {
  return new Response(
    `event: text-delta\ndata: ${JSON.stringify({ text: "Generated letter" })}\n\n`
  )
}

function generationFetch() {
  const generation = Promise.withResolvers<Response>()
  const started = Promise.withResolvers<void>()
  const fetcher = vi.fn(async (url: RequestInfo | URL) => {
    if (String(url).endsWith("/turns")) {
      started.resolve()
      return generation.promise
    }
    return Response.json({ ok: true, data: {} })
  })
  vi.stubGlobal("fetch", fetcher)
  return { generation, started, fetcher }
}

function continuation(onWritten: (text: string) => void = vi.fn()) {
  return {
    record: {
      docId: DOC,
      chatId: "stopped-chat",
      prompt: "Draft a cover letter",
      jobId: null,
    },
    owner: "person-1",
    queryClient: new QueryClient(),
    signal: new AbortController().signal,
    onWritten,
    isBlank: () => true,
  }
}

it("preserves words entered during generation", async () => {
  const { generation, started } = generationFetch()
  let text = ""
  const written = vi.fn()
  const input = { ...continuation(written), isBlank: () => text === "" }
  const pending = redraftStoppedLetter(input)
  await started.promise
  text = "Words I typed"
  generation.resolve(generatedResponse())
  await expect(pending).rejects.toThrow("Your text is unchanged")
  expect(text).toBe("Words I typed")
  expect(written).not.toHaveBeenCalled()
})

it("continues in the stopped Chat and writes when the page stays blank", async () => {
  const { generation, fetcher } = generationFetch()
  generation.resolve(generatedResponse())
  const written = vi.fn()
  await redraftStoppedLetter(continuation(written))
  expect(
    fetcher.mock.calls.some(([url]) =>
      String(url).endsWith("/chats/stopped-chat/turns")
    )
  ).toBe(true)
  expect(
    fetcher.mock.calls.some(([url]) => String(url).includes("chat.create"))
  ).toBe(false)
  expect(written).toHaveBeenCalledWith("Generated letter")
})
