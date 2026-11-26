import { afterEach, expect, it, vi } from "vitest"
import type { WordPage, WordParagraph } from "@workspace/domain/paper-doc"

import { diffParagraphs } from "@/features/paper-page/page-diff.ts"
import { QueryClient } from "@tanstack/react-query"
import { subscribeWritingRefresh } from "@/lib/writing-refresh.ts"
import { loadDraft, storeDraft } from "@/features/paper-page/canvas-edit.ts"
import { wordPageReceipt } from "@/test/word-page-receipt.ts"
import {
  blocksForLetterLines,
  redraftStoppedLetter,
} from "./paper-letter-continue.ts"

const DOC = "11111111-1111-4111-8111-111111111111"
const REVISION = "22222222-2222-4222-8222-222222222222"
const HANDLE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

function line(handle: string, text: string): WordParagraph {
  return {
    handle,
    text,
    pieces: text === "" ? [] : [{ text, editable: true }],
    held: false,
    message: "",
    code: null,
  }
}

function pageOf(paragraph: WordParagraph): WordPage {
  return {
    doc: DOC,
    revision: REVISION,
    name: "Letter.docx",
    label: "letter",
    paragraphs: [paragraph],
  }
}

it("writes a stopped letter into the blank page that is already open", () => {
  const page = pageOf(line(HANDLE, ""))
  const diff = diffParagraphs(
    page,
    blocksForLetterLines(page, ["Dear hiring team,", "I am writing."]),
    null
  )
  expect(diff).toEqual({
    ops: [
      { op: "setText", handle: HANDLE, text: "Dear hiring team," },
      { op: "insert", after: HANDLE, text: "I am writing." },
    ],
  })
})

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

function generatedResponse() {
  return new Response(
    `event: text-delta\ndata: ${JSON.stringify({ text: "Generated letter" })}\n\n`
  )
}

const savedLetter = () =>
  Response.json({
    ok: true,
    data: wordPageReceipt({ docId: DOC, revision: REVISION, kind: "letter" }),
  })

function canvasCalls(fetcher: ReturnType<typeof vi.fn>) {
  return fetcher.mock.calls.filter(([url]) =>
    String(url).includes("/api/commands/paper.canvas")
  )
}

function generationFetch(
  page = pageOf(line(HANDLE, "")),
  canvas: () => Promise<Response> = async () => savedLetter()
) {
  const generation = Promise.withResolvers<Response>()
  const started = Promise.withResolvers<void>()
  const fetcher = vi.fn(async (url: RequestInfo | URL) => {
    const path = String(url)
    if (path.includes("/api/commands/paper.canvas")) return canvas()
    if (path.endsWith("/turns")) {
      started.resolve()
      return generation.promise
    }
    if (path.includes("paper.read")) {
      return Response.json({ ok: true, data: page })
    }
    return Response.json({ ok: true, data: {} })
  })
  vi.stubGlobal("fetch", fetcher)
  return { generation, started, fetcher }
}

function continuation(onWritten?: (text: string) => void) {
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

it("preserves words typed into the local draft while Continue is generating", async () => {
  const { generation, started, fetcher } = generationFetch()
  const input = continuation()
  const pending = redraftStoppedLetter(input)
  await started.promise
  storeDraft(
    DOC,
    {
      blocks: [{ id: HANDLE, text: "My own opening" }],
      caret: { blockId: HANDLE, offset: 14 },
      nextId: 2,
    },
    localStorage
  )
  generation.resolve(generatedResponse())
  await expect(pending).rejects.toThrow("Your text is unchanged")
  expect(loadDraft(DOC, localStorage)?.blocks[0].text).toBe("My own opening")
  expect(canvasCalls(fetcher)).toEqual([])
})

it("preserves rich letter words entered during generation", async () => {
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

it("refuses to replace saved words found after generation", async () => {
  const { generation, fetcher } = generationFetch(
    pageOf(line(HANDLE, "Saved words"))
  )
  generation.resolve(generatedResponse())
  const input = continuation()
  await expect(redraftStoppedLetter(input)).rejects.toThrow(
    "Your text is unchanged"
  )
  expect(canvasCalls(fetcher)).toEqual([])
})

it("continues in the stopped Chat and writes when the page stays blank", async () => {
  const { generation, fetcher } = generationFetch()
  generation.resolve(generatedResponse())
  const written = vi.fn()
  const input = continuation(written)
  await redraftStoppedLetter(input)
  expect(
    fetcher.mock.calls.some(([url]) =>
      String(url).endsWith("/chats/stopped-chat/turns")
    )
  ).toBe(true)
  expect(
    fetcher.mock.calls.some(([url]) => String(url).includes("chat.create"))
  ).toBe(false)
  expect(canvasCalls(fetcher)).toEqual([])
  expect(written).toHaveBeenCalledWith("Generated letter")
})

it.each(["My words typed while save is pending", ""])(
  "preserves a newer local draft %j while the final canvas command is pending",
  async (words) => {
    const command = Promise.withResolvers<Response>()
    const started = Promise.withResolvers<void>()
    const { generation } = generationFetch(undefined, () => {
      started.resolve()
      return command.promise
    })
    generation.resolve(generatedResponse())
    const input = continuation()
    const refreshed = vi.fn()
    const unsubscribe = subscribeWritingRefresh(refreshed)
    try {
      const pending = redraftStoppedLetter(input)
      await started.promise
      storeDraft(
        DOC,
        {
          blocks: [{ id: HANDLE, text: words }],
          caret: { blockId: HANDLE, offset: words.length },
          nextId: 2,
        },
        localStorage
      )
      command.resolve(savedLetter())
      await expect(pending).resolves.toBeUndefined()
      expect(loadDraft(DOC, localStorage)?.blocks[0].text).toBe(words)
      expect(refreshed).toHaveBeenCalledTimes(1)
    } finally {
      unsubscribe()
    }
  }
)

it("refreshes the generated letter when the canvas command finishes on a blank page", async () => {
  const { generation, fetcher } = generationFetch()
  generation.resolve(generatedResponse())
  const input = continuation()
  const refreshed = vi.fn()
  const unsubscribe = subscribeWritingRefresh(refreshed)
  try {
    await redraftStoppedLetter(input)
    const [call] = canvasCalls(fetcher) as [RequestInfo, RequestInit][]
    expect(JSON.parse(String(call?.[1]?.body)).input).toMatchObject({
      op: "write",
    })
    expect(call?.[1]?.signal).toBe(input.signal)
    expect(refreshed).toHaveBeenCalledTimes(1)
  } finally {
    unsubscribe()
  }
})
