import "fake-indexeddb/auto"

import { QueryClient } from "@tanstack/react-query"
import { afterEach, expect, it, vi } from "vitest"
import {
  act,
  cleanup,
  fireEvent,
  screen,
  waitFor,
} from "@testing-library/react"

import { wordPageReceipt } from "@/test/word-page-receipt.ts"
import { expectNoReadFrom } from "@/test/paper-page-reads.ts"
import { render } from "@/test/render-with-client.tsx"
import { storeDraft } from "@/features/paper-page/canvas-edit.ts"
import { closeWritingDb } from "@/features/paper-page/canvas-save.ts"
import {
  notifyWritingRefresh,
  setWritingConflict,
  WRITING_CONFLICT_NOTE,
} from "@/lib/writing-refresh.ts"
import {
  attachWritingProposal,
  clearWritingProposal,
  publishWritingProposal,
  syncWritingProposalFromActions,
} from "@/lib/writing-proposal.ts"
import {
  clearStoppedLetter,
  rememberStoppedLetter,
  stoppedLetter,
} from "./paper-letter-resume.ts"
import { DOWNLOAD_WAITS_FOR_SAVE, WritingPage } from "./writing-page.tsx"
import { redraftStoppedLetter } from "./paper-letter-continue.ts"

const DOC = "11111111-1111-4111-8111-111111111111"
const PARAGRAPH = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const REVISION = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"

function draft(text: string) {
  return {
    blocks: [{ id: PARAGRAPH, text }],
    caret: { blockId: PARAGRAPH, offset: 0 },
    nextId: 2,
  }
}

const NEXT = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"

function lineOf(handle: string, text: string) {
  return {
    handle,
    text,
    pieces: text === "" ? [] : [{ text, editable: true }],
    held: false,
    message: "",
    code: null,
  }
}

function readPage(text: string, revision = REVISION, before: unknown[] = []) {
  return {
    doc: DOC,
    revision,
    name: "Page.docx",
    label: "letter",
    paragraphs: [...before, lineOf(PARAGRAPH, text)],
  }
}

function words() {
  const article = screen.getByRole("article", { name: "Page" })
  return [...article.querySelectorAll(":scope > p")].map((block) =>
    (block.textContent ?? "").replaceAll("\u200b", "")
  )
}

afterEach(async () => {
  clearWritingProposal()
  clearStoppedLetter()
  setWritingConflict(null)
  localStorage.clear()
  cleanup()
  vi.unstubAllGlobals()
  await closeWritingDb()
  await new Promise<void>((resolve, reject) => {
    const deleting = indexedDB.deleteDatabase("opencv-writing")
    deleting.onsuccess = () => resolve()
    deleting.onerror = () => reject(deleting.error)
    deleting.onblocked = () => resolve()
  })
})

it("shows the approved words without a reload", async () => {
  let serverText = "Before line"
  const calls: string[] = []
  vi.stubGlobal("fetch", async (url: RequestInfo | URL) => {
    const path = String(url)
    calls.push(path)
    if (path.includes("/api/reads/paper.read")) {
      return Response.json({ ok: true, data: readPage(serverText) })
    }
    return Response.json({ ok: true, data: {} })
  })
  render(<WritingPage docId={DOC} seed={draft("Before line")} />)
  await waitFor(() => expect(words()).toEqual(["Before line"]))
  serverText = "After line"
  notifyWritingRefresh()
  await waitFor(() => expect(words()).toEqual(["After line"]))
  expect(calls.some((path) => path.includes("/api/commands/paper.edit"))).toBe(
    false
  )
  expect(screen.queryByText("Coach's change approved")).not.toBeInTheDocument()
  expect(
    screen.queryByRole("region", { name: "Coach proposal" })
  ).not.toBeInTheDocument()
})

it.each([
  ["approved", "After line", true],
  ["undone", "Before line again", true],
  ["denied", "Before line", false],
  ["failed", "Before line", false],
] as const)(
  "logs no console error while the page renders a Coach receipt that was %s",
  async (_outcome, after, rereads) => {
    let serverText = "Before line"
    const errors = vi.spyOn(console, "error")
    vi.stubGlobal("fetch", async (url: RequestInfo | URL) => {
      if (String(url).includes("/api/reads/paper.read")) {
        return Response.json({ ok: true, data: readPage(serverText) })
      }
      return Response.json({ ok: true, data: {} })
    })
    render(<WritingPage docId={DOC} seed={draft("Before line")} />)
    await waitFor(() => expect(words()).toEqual(["Before line"]))
    serverText = after
    if (rereads) notifyWritingRefresh()
    await waitFor(() => expect(words()).toEqual([after]))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(errors.mock.calls.map((call) => String(call[0]))).toEqual([])
    errors.mockRestore()
  }
)

const READS_TO_OPEN_A_PAGE_THAT_CHANGED_ELSEWHERE = 2

it("keeps unsent words when the approved page is newer", async () => {
  const calls: string[] = []
  vi.stubGlobal("fetch", async (url: RequestInfo | URL) => {
    const path = String(url)
    calls.push(path)
    if (path.includes("/api/reads/paper.read")) {
      return Response.json({
        ok: true,
        data: readPage("After line", NEXT),
      })
    }
    return Response.json({ ok: true, data: {} })
  })
  storeDraft(DOC, draft("Before line extra"), localStorage, {
    revision: REVISION,
    words: "Before line",
  })
  render(
    <WritingPage
      docId={DOC}
      seed={draft("Before line")}
      seedRevision={REVISION}
    />
  )
  await waitFor(() =>
    expect(screen.getByRole("status")).toHaveTextContent(WRITING_CONFLICT_NOTE)
  )
  expect(words()).toEqual(["Before line extra"])
  const reads = () => calls.filter((path) => path.includes("paper.read")).length
  await expectNoReadFrom(
    notifyWritingRefresh,
    reads,
    READS_TO_OPEN_A_PAGE_THAT_CHANGED_ELSEWHERE
  )
  expect(words()).toEqual(["Before line extra"])
  expect(screen.getByRole("status")).toHaveTextContent(WRITING_CONFLICT_NOTE)
  expect(screen.getByRole("status").textContent).not.toMatch(/\bSaved\b/)
  expect(calls.some((path) => path.includes("/api/commands/paper.edit"))).toBe(
    false
  )
})

it("says Saved for an imported letter and does not call that a conflict", async () => {
  const address = "66666666-6666-4666-8666-666666666666"
  const reason =
    "Paper cannot safely preserve a property attached to this text yet."
  const letter = {
    blocks: [
      { id: address, text: "1 Main Street", held: true, reason },
      { id: PARAGRAPH, text: "Thank you" },
    ],
    caret: { blockId: PARAGRAPH, offset: 0 },
    nextId: 3,
  }
  const shown = readPage("Thank you", REVISION, [
    {
      handle: address,
      text: "1 Main Street",
      pieces: [{ text: "1 Main Street", editable: false }],
      held: true,
      message: reason,
      code: "NOT_BODY",
    },
  ])
  vi.stubGlobal("fetch", async (url: RequestInfo | URL) => {
    const path = String(url)
    if (path.includes("/api/reads/paper.read")) {
      return Response.json({
        ok: true,
        data: shown,
      })
    }
    return Response.json({ ok: true, data: {} })
  })
  render(<WritingPage docId={DOC} seed={letter} seedRevision={REVISION} />)
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toMatch(/\bSaved\b/)
  )
  expect(words()).toEqual(["1 Main Street", "Thank you"])
  expect(screen.getByText(reason)).toBeVisible()
  notifyWritingRefresh()
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toMatch(/\bSaved\b/)
  )
  expect(screen.getByRole("status").textContent).not.toContain(
    WRITING_CONFLICT_NOTE
  )
  expect(words()).toEqual(["1 Main Street", "Thank you"])
})

function exportOf(revision: string) {
  return {
    generation: "package",
    docId: DOC,
    revision,
    name: "Cover letter.docx",
    kind: "letter",
    packageHash: "ab".repeat(32),
    byteSize: 128,
    downloadPath: `/api/paper/packages/${DOC}/export?at=${revision}`,
  }
}

it("downloads the saved revision as a Word file named after the page", async () => {
  const exports: string[] = []
  vi.stubGlobal("fetch", async (url: RequestInfo | URL, init?: RequestInit) => {
    const path = String(url)
    if (path.includes("/api/reads/paper.export")) {
      const asked = `${path} ${String(init?.body ?? "")}`
      exports.push(asked)
      return Response.json({
        ok: true,
        data: exportOf(asked.includes(NEXT) ? NEXT : REVISION),
      })
    }
    if (path.includes("/api/reads/paper.read")) {
      return Response.json({ ok: true, data: readPage("Saved line") })
    }
    throw new Error(`Unexpected request: ${path}`)
  })
  render(
    <WritingPage
      docId={DOC}
      seed={draft("Saved line")}
      seedRevision={REVISION}
    />
  )
  const link = await screen.findByRole("link", { name: "Download Word" })
  expect(link.getAttribute("href")).toContain(
    `/api/paper/packages/${DOC}/export?at=${REVISION}`
  )
  expect(link.getAttribute("download")).toBe("Cover letter.docx")
  expect(screen.queryByText(DOWNLOAD_WAITS_FOR_SAVE)).toBeNull()
  expect(exports.some((path) => path.includes(REVISION))).toBe(true)
})

it("holds Download Word for unsent canvas words even when shared storage claims Saved", async () => {
  const exports: string[] = []
  const write = Promise.withResolvers<Response>()
  const started = Promise.withResolvers<void>()
  let serverText = "Saved line"
  let serverRevision = REVISION
  vi.stubGlobal("fetch", async (url: RequestInfo | URL, init?: RequestInit) => {
    const path = String(url)
    if (path.includes("/api/reads/paper.export")) {
      const asked = `${path} ${String(init?.body ?? "")}`
      exports.push(asked)
      return Response.json({
        ok: true,
        data: exportOf(asked.includes(NEXT) ? NEXT : REVISION),
      })
    }
    if (path.includes("/api/reads/paper.read")) {
      return Response.json({
        ok: true,
        data: readPage(serverText, serverRevision),
      })
    }
    if (path.includes("/api/commands/paper.canvas")) {
      started.resolve()
      return write.promise
    }
    throw new Error(`Unexpected request: ${path}`)
  })
  storeDraft(DOC, draft("Saved line and more"), localStorage, {
    revision: REVISION,
    words: "Saved line",
  })
  const page = render(
    <WritingPage
      docId={DOC}
      seed={draft("Saved line")}
      seedRevision={REVISION}
    />
  )
  try {
    await started.promise
    const button = await screen.findByRole("button", { name: "Download Word" })
    expect(button).toBeDisabled()
    expect(button).toHaveAccessibleDescription(DOWNLOAD_WAITS_FOR_SAVE)
    expect(screen.queryByRole("link", { name: "Download Word" })).toBeNull()
    expect(exports).toEqual([])
    act(() => {
      storeDraft(DOC, draft("Saved line and more"), localStorage, {
        revision: NEXT,
        words: "Saved line and more",
      })
    })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(screen.queryByRole("link", { name: "Download Word" })).toBeNull()
    expect(screen.getByRole("button", { name: "Download Word" })).toBeDisabled()
    expect(exports).toEqual([])
  } finally {
    page.unmount()
    serverText = "Saved line and more"
    serverRevision = NEXT
    await act(async () => {
      write.resolve(
        Response.json({
          ok: true,
          data: wordPageReceipt({
            docId: DOC,
            revision: NEXT,
            name: "Cover letter.docx",
            kind: "letter",
          }),
        })
      )
      await write.promise
    })
  }
  render(
    <WritingPage docId={DOC} seed={draft(serverText)} seedRevision={NEXT} />
  )
  const link = await screen.findByRole("link", { name: "Download Word" })
  expect(screen.getByRole("status")).toHaveTextContent("Saved")
  expect(link.getAttribute("href")).toContain(`export?at=${NEXT}`)
})

it("keeps document identity, saving and Word download together with Paper navigation", async () => {
  const back = vi.fn()
  vi.stubGlobal("fetch", async (url: RequestInfo | URL) => {
    const path = String(url)
    if (path.includes("/api/reads/paper.export"))
      return Response.json({ ok: true, data: exportOf(REVISION) })
    if (path.includes("/api/reads/paper.read"))
      return Response.json({ ok: true, data: readPage("Saved line") })
    throw new Error(`Unexpected request: ${path}`)
  })
  render(
    <WritingPage
      docId={DOC}
      title="Designer CV"
      onBack={back}
      seed={draft("Saved line")}
      seedRevision={REVISION}
    />
  )
  const heading = screen.getByRole("heading", { name: "Designer CV" })
  const header = screen.getByRole("banner")
  expect(header).not.toBeNull()
  expect(heading).toBeVisible()
  expect(header).toHaveTextContent("Designer CV")
  await waitFor(() =>
    expect(screen.getByRole("status")).toHaveTextContent("Saved")
  )
  expect(header).toContainElement(screen.getByRole("status"))
  expect(header).toContainElement(
    await screen.findByRole("link", { name: "Download Word" })
  )
  fireEvent.click(screen.getByRole("link", { name: "Back to Paper" }))
  expect(back).toHaveBeenCalledOnce()
  expect(screen.queryByRole("button", { name: "Save", exact: true })).toBeNull()
})

it("refuses a Word download link when preparation rejects the saved revision", async () => {
  vi.stubGlobal("fetch", async (url: RequestInfo | URL) => {
    const path = String(url)
    if (path.includes("/api/reads/paper.export"))
      return Response.json(
        {
          ok: false,
          error: { code: "CONFLICT", message: "Read this document again." },
        },
        { status: 409 }
      )
    if (path.includes("/api/reads/paper.read"))
      return Response.json({ ok: true, data: readPage("Saved line") })
    throw new Error(`Unexpected request: ${path}`)
  })
  render(
    <WritingPage
      docId={DOC}
      seed={draft("Saved line")}
      seedRevision={REVISION}
    />
  )
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Download unavailable"
  )
  expect(screen.queryByRole("link", { name: "Download Word" })).toBeNull()
  expect(screen.getByRole("button", { name: "Download Word" })).toBeDisabled()
  expect(
    screen.getByRole("button", { name: "Download Word" })
  ).toHaveAccessibleDescription("Could not prepare this Word download.")
})

function enterWords(text: string) {
  const page = screen.getByRole("article", { name: "Page" })
  fireEvent(
    page,
    new InputEvent("beforeinput", {
      inputType: "insertText",
      data: text,
      bubbles: true,
      cancelable: true,
    })
  )
}

it("keeps newer local words and reports the saved Coach draft as a page conflict", async () => {
  const command = Promise.withResolvers<Response>()
  const started = Promise.withResolvers<void>()
  let canvasSends = 0
  vi.stubGlobal("fetch", async (url: RequestInfo | URL) => {
    if (String(url).endsWith("/turns"))
      return new Response(
        `event: text-delta\ndata: ${JSON.stringify({ text: "Generated letter" })}\n\n`
      )
    if (String(url).includes("/api/commands/paper.canvas")) {
      canvasSends += 1
      started.resolve()
      return command.promise
    }
    return Response.json({ ok: true, data: readPage("") })
  })
  render(<WritingPage docId={DOC} seed={draft("")} seedRevision={REVISION} />)
  await waitFor(() => expect(words()).toEqual([""]))
  const queryClient = new QueryClient()
  try {
    const pending = redraftStoppedLetter({
      record: {
        docId: DOC,
        chatId: "stopped-chat",
        prompt: "Draft a letter",
        jobId: null,
      },
      owner: "person-1",
      queryClient,
      signal: new AbortController().signal,
      isBlank: () => words().join("") === "",
    })
    await started.promise
    enterWords("My newer opening")
    await act(async () => {
      command.resolve(
        Response.json({
          ok: true,
          data: wordPageReceipt({ docId: DOC, revision: NEXT, kind: "letter" }),
        })
      )
      await pending
    })
    expect(words()).toEqual(["My newer opening"])
    expect(screen.getByRole("status")).toHaveTextContent(WRITING_CONFLICT_NOTE)
    expect(screen.queryByText(/Coach's draft was not applied/)).toBeNull()
    expect(canvasSends).toBe(1)
  } finally {
    queryClient.clear()
  }
})

it("clears a stopped notice from document edits even without an input event", async () => {
  vi.stubGlobal("fetch", async () =>
    Response.json({ ok: true, data: readPage("") })
  )
  rememberStoppedLetter({
    docId: DOC,
    chatId: "stopped-chat",
    prompt: "Draft a letter",
    jobId: null,
  })
  render(<WritingPage docId={DOC} seed={draft("")} seedRevision={REVISION} />)
  expect(
    screen.getByRole("button", { name: "Continue drafting" })
  ).toBeVisible()
  enterWords("My opening")
  await waitFor(() => expect(stoppedLetter()).toBeNull())
  expect(words()).toEqual(["My opening"])
  expect(screen.queryByRole("button", { name: "Continue drafting" })).toBeNull()
})

it("keeps a settled receipt row on the next document edit", async () => {
  vi.stubGlobal("fetch", async () =>
    Response.json({ ok: true, data: readPage("After") })
  )
  render(
    <WritingPage docId={DOC} seed={draft("After")} seedRevision={REVISION} />
  )
  await waitFor(() =>
    expect(screen.getByRole("status")).toHaveTextContent("Saved")
  )
  act(() => {
    publishWritingProposal("own-call", {
      docId: DOC,
      edits: [{ op: "replaceText", before: "Before", after: "After" }],
    })
    attachWritingProposal("own-call", "own-action")
    syncWritingProposalFromActions(
      [
        {
          toolCallId: "own-call",
          operation: "paper.edit",
          input: { docId: DOC },
          state: "committed",
          proposalId: "own-action",
          activityId: "own-activity",
        },
      ],
      []
    )
  })
  expect(screen.getByText("Coach's change approved")).toBeVisible()
  const row = screen.getByRole("region", { name: "Coach proposal" })
  enterWords("Extra ")
  await waitFor(() => expect(words()).toEqual(["Extra After"]))
  expect(screen.getByText("Coach's change approved")).toBeVisible()
  expect(screen.getByRole("region", { name: "Coach proposal" })).toBe(row)
})
