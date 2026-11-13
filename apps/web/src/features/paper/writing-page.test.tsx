import "fake-indexeddb/auto"

import { afterEach, expect, it, vi } from "vitest"
import {
  act,
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"

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
  WORD_BATCH_HIDDEN,
  writingProposal,
} from "@/lib/writing-proposal.ts"
import { DOWNLOAD_WAITS_FOR_SAVE, WritingPage } from "./writing-page.tsx"

const DOC = "11111111-1111-4111-8111-111111111111"
const PARAGRAPH = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const REVISION = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const PENDING = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
const ACTIVITY = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
const TARGET = `t_${"ab".repeat(32)}`

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

it("ignores a Coach edit that is not one replacement", () => {
  publishWritingProposal("call-empty", {
    docId: DOC,
    edits: [],
  })
  publishWritingProposal("call-two", {
    docId: DOC,
    edits: [
      { op: "replaceText", before: "One", after: "Two" },
      { op: "replaceText", before: "Three", after: "Four" },
    ],
  })
  expect(writingProposal()).toBeNull()
})

it("approves a Coach replacement onto the page and undoes it", async () => {
  let serverText = "Before line"
  const calls: string[] = []
  vi.stubGlobal("fetch", async (url: RequestInfo | URL) => {
    const path = String(url)
    calls.push(path)
    if (path.includes("/api/commands/actions.approve")) {
      serverText = "After line"
      return Response.json({ ok: true, data: { id: ACTIVITY } })
    }
    if (path.includes("/api/commands/activity.undo")) {
      serverText = "Before line"
      return Response.json({ ok: true, data: { id: ACTIVITY } })
    }
    if (path.includes("/api/reads/paper.read")) {
      return Response.json({ ok: true, data: readPage(serverText) })
    }
    return Response.json({ ok: true, data: {} })
  })
  localStorage.setItem(
    `opencv-writing:${DOC}`,
    JSON.stringify(draft("Before line"))
  )
  publishWritingProposal("call-1", {
    docId: DOC,
    basedOn: REVISION,
    edits: [
      {
        op: "replaceText",
        targetId: TARGET,
        before: "Before line",
        after: "After line",
      },
    ],
  })
  attachWritingProposal("call-1", PENDING)
  render(<WritingPage docId={DOC} seed={draft("Before line")} />)
  const proposal = await screen.findByRole("region", {
    name: "Coach proposal",
  })
  expect(proposal).toHaveTextContent("Before")
  expect(proposal).toHaveTextContent("Before line")
  expect(proposal).toHaveTextContent("After")
  expect(proposal).toHaveTextContent("After line")
  await waitFor(() => expect(words()).toEqual(["Before line"]))
  fireEvent.click(screen.getByRole("button", { name: "Approve" }))
  await waitFor(() => expect(words()).toEqual(["After line"]))
  expect(screen.getByRole("button", { name: "Undo" })).toBeVisible()
  expect(
    calls.some((path) => path.includes("/api/commands/actions.approve"))
  ).toBe(true)
  expect(localStorage.getItem(`opencv-writing:${DOC}`)).toContain("After line")
  fireEvent.click(screen.getByRole("button", { name: "Undo" }))
  await waitFor(() => expect(words()).toEqual(["Before line"]))
  expect(screen.getByText("Undone")).toBeVisible()
  expect(
    calls.some((path) => path.includes("/api/commands/activity.undo"))
  ).toBe(true)
})

it("shows a waiting change as the words before and after", async () => {
  const before = "The second line stays blue."
  const after = "The second line stays green."
  const input = {
    docId: DOC,
    edits: [{ op: "replaceText", before, after }],
  }
  vi.stubGlobal("fetch", async () =>
    Response.json({ ok: true, data: readPage(before) })
  )
  syncWritingProposalFromActions(
    [
      {
        toolCallId: "call-9",
        operation: "paper.edit",
        state: "proposed",
        proposalId: PENDING,
        input,
      },
    ],
    [{ id: PENDING, status: "pending", input: { command: "paper.edit" } }]
  )
  render(<WritingPage docId={DOC} seed={draft(before)} />)
  const proposal = await screen.findByRole("region", { name: "Coach proposal" })
  expect(proposal).toHaveTextContent("Before")
  expect(proposal).toHaveTextContent(before)
  expect(proposal).toHaveTextContent("After")
  expect(proposal).toHaveTextContent(after)
  expect(proposal).not.toHaveTextContent('{"command":"paper.edit"}')
})

it("lists every operation of a waiting Word batch before approval", async () => {
  const handle = "33333333-3333-4333-8333-333333333333"
  const input = {
    docId: DOC,
    basedOn: REVISION,
    edits: [
      { op: "setText", handle, text: "Dear Grace," },
      { op: "insert", after: handle, text: "I write about the role." },
      { op: "delete", handle: "44444444-4444-4444-8444-444444444444" },
    ],
  }
  vi.stubGlobal("fetch", async () =>
    Response.json({ ok: true, data: readPage("Dear Ada,") })
  )
  syncWritingProposalFromActions(
    [
      {
        toolCallId: "call-batch",
        operation: "paper.edit",
        state: "proposed",
        proposalId: PENDING,
        input,
      },
    ],
    [
      {
        id: PENDING,
        status: "pending",
        input,
        review: {
          docId: DOC,
          basedOn: REVISION,
          operations: [
            { op: "setText", before: "Dear Ada,", after: "Dear Grace," },
            {
              op: "insert",
              before: "",
              after: "I write about the role.",
              place: "Dear Ada,",
            },
            { op: "delete", before: "Old line", after: "" },
          ],
        },
      },
    ]
  )
  render(<WritingPage docId={DOC} seed={draft("Dear Ada,")} />)
  const proposal = await screen.findByRole("region", { name: "Coach proposal" })
  expect(within(proposal).getAllByRole("listitem")).toHaveLength(3)
  expect(proposal).toHaveTextContent("Change a line")
  expect(proposal).toHaveTextContent("Dear Grace,")
  expect(proposal).toHaveTextContent("Add a line")
  expect(proposal).toHaveTextContent("I write about the role.")
  expect(proposal).toHaveTextContent("After this line: Dear Ada,")
  expect(proposal).toHaveTextContent("Remove a line")
  expect(proposal).toHaveTextContent("Old line")
  expect(
    within(proposal).getByRole("button", { name: "Approve" })
  ).toBeEnabled()
})

it("shows nothing to approve for a Word batch without its review", async () => {
  vi.stubGlobal("fetch", async () =>
    Response.json({ ok: true, data: readPage("Dear Ada,") })
  )
  syncWritingProposalFromActions(
    [
      {
        toolCallId: "call-unreviewed",
        operation: "paper.edit",
        state: "proposed",
        proposalId: PENDING,
        input: {
          docId: DOC,
          edits: [{ op: "insert", after: null, text: "Unseen words" }],
        },
      },
    ],
    [{ id: PENDING, status: "pending", input: {} }]
  )
  render(<WritingPage docId={DOC} seed={draft("Dear Ada,")} />)
  expect(await screen.findByText(WORD_BATCH_HIDDEN)).toBeVisible()
  expect(
    screen.queryByRole("button", { name: "Approve" })
  ).not.toBeInTheDocument()
  expect(writingProposal()?.withheld).toBe(WORD_BATCH_HIDDEN)
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
    return new Promise<Response>(() => undefined)
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

it("holds Download Word while words are not saved yet", async () => {
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
    return new Promise<Response>(() => undefined)
  })
  storeDraft(DOC, draft("Saved line and more"), localStorage, {
    revision: REVISION,
    words: "Saved line",
  })
  render(
    <WritingPage
      docId={DOC}
      seed={draft("Saved line")}
      seedRevision={REVISION}
    />
  )
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
  const link = await screen.findByRole("link", { name: "Download Word" })
  expect(link.getAttribute("href")).toContain(`export?at=${NEXT}`)
})
