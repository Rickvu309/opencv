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

import { render } from "@/test/render-with-client.tsx"
import { closeWritingDb } from "@/features/paper-page/canvas-save.ts"
import { notifyWritingRefresh } from "@/lib/writing-refresh.ts"
import {
  attachWritingProposal,
  clearWritingProposal,
  publishWritingProposal,
  syncWritingProposalFromActions,
  WORD_BATCH_HIDDEN,
  noteWritingUndo,
  writingProposal,
} from "@/lib/writing-proposal.ts"
import { storeDraft } from "@/features/paper-page/canvas-edit.ts"
import { rememberStoppedLetter, stoppedLetter } from "./paper-letter-resume.ts"
import {
  WritingDocumentNoticeSync,
  WritingProposalCard,
} from "./writing-proposal.tsx"
import { WritingPage } from "./writing-page.tsx"

const DOC = "11111111-1111-4111-8111-111111111111"
const PARAGRAPH = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const REVISION = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const PENDING = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
const TARGET = `t_${"ab".repeat(32)}`

function draft(text: string) {
  return {
    blocks: [{ id: PARAGRAPH, text }],
    caret: { blockId: PARAGRAPH, offset: 0 },
    nextId: 2,
  }
}

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

afterEach(async () => {
  clearWritingProposal()
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

it("names one Coach change and reviews it in Coach", async () => {
  vi.stubGlobal("fetch", async (url: RequestInfo | URL) => {
    if (String(url).includes("/api/reads/paper.read")) {
      return Response.json({ ok: true, data: readPage("Before line") })
    }
    return Response.json({ ok: true, data: {} })
  })
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
  const dock = document.createElement("button")
  dock.setAttribute("data-dock-coach", "")
  dock.setAttribute("aria-expanded", "false")
  dock.setAttribute("aria-controls", "coach-panel")
  const opened = vi.fn(() => dock.setAttribute("aria-expanded", "true"))
  dock.addEventListener("click", opened)
  const panel = document.createElement("div")
  panel.id = "coach-panel"
  const card = document.createElement("div")
  card.setAttribute("aria-label", "Review Coach action")
  const approve = document.createElement("button")
  approve.textContent = "Approve"
  card.tabIndex = -1
  card.append(approve)
  panel.append(card)
  document.body.append(dock, panel)
  try {
    render(<WritingPage docId={DOC} seed={draft("Before line")} />)
    const proposal = await screen.findByRole("region", {
      name: "Coach proposal",
    })
    expect(proposal).toHaveTextContent("Coach suggested 1 change")
    const announcement = within(proposal).getByRole("status")
    expect(proposal).toHaveClass("min-h-24", "md:min-h-16")
    expect(proposal).not.toHaveTextContent("(empty line)")
    expect(proposal).not.toHaveTextContent("Before")
    expect(
      within(proposal).queryByRole("button", { name: "Approve" })
    ).toBeNull()
    fireEvent.click(
      within(proposal).getByRole("button", { name: "Review in Coach" })
    )
    await act(async () => {
      await new Promise((resolve) =>
        requestAnimationFrame(() => resolve(undefined))
      )
    })
    expect(opened).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(card)
    act(() => notifyWritingRefresh())
    expect(within(proposal).getByRole("status")).toBe(announcement)
    expect(proposal).toHaveTextContent("Coach suggested 1 change")
    act(() => {
      syncWritingProposalFromActions(
        [
          {
            toolCallId: "call-1",
            operation: "paper.edit",
            state: "committed",
            activityId: "activity-1",
            proposalId: PENDING,
            input: { docId: DOC },
          },
        ],
        []
      )
    })
    expect(within(proposal).getByRole("status")).toHaveTextContent(
      "Coach's change approved"
    )
    expect(proposal).toHaveClass("min-h-24", "md:min-h-16")
  } finally {
    dock.remove()
    panel.remove()
  }
})

it("says when Coach cannot be opened from the page", async () => {
  vi.stubGlobal("fetch", async () =>
    Response.json({ ok: true, data: readPage("Before line") })
  )
  publishWritingProposal("call-1", {
    docId: DOC,
    edits: [{ op: "replaceText", before: "Before line", after: "After line" }],
  })
  render(<WritingPage docId={DOC} seed={draft("Before line")} />)
  const proposal = await screen.findByRole("region", { name: "Coach proposal" })
  fireEvent.click(
    within(proposal).getByRole("button", { name: "Review in Coach" })
  )
  expect(within(proposal).getByRole("alert")).toHaveTextContent(
    "Open Coach from the dock to review this change."
  )
})

it("summarizes a waiting replacement without duplicating its diff", async () => {
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
  expect(proposal).toHaveTextContent("Coach suggested 1 change")
  expect(proposal).not.toHaveTextContent(before)
  expect(proposal).not.toHaveTextContent(after)
  expect(proposal).not.toHaveTextContent('{"command":"paper.edit"}')
})

it("summarizes the count of a waiting Word batch for review in Coach", async () => {
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
  expect(proposal).toHaveTextContent("Coach suggested 3 changes")
  expect(proposal).not.toHaveTextContent("(empty line)")
  expect(proposal).not.toHaveTextContent("Dear Grace,")
  expect(within(proposal).queryByRole("button", { name: "Approve" })).toBeNull()
  expect(
    within(proposal).getByRole("button", { name: "Review in Coach" })
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
  const proposal = await screen.findByRole("region", { name: "Coach proposal" })
  expect(within(proposal).getByRole("status")).toHaveTextContent(
    WORD_BATCH_HIDDEN
  )
  expect(proposal).not.toHaveTextContent("(empty line)")
  expect(
    within(proposal).queryByRole("button", { name: "Approve" })
  ).not.toBeInTheDocument()
  expect(
    within(proposal).getByRole("button", { name: "Review in Coach" })
  ).toBeEnabled()
  expect(writingProposal()?.withheld).toBe(WORD_BATCH_HIDDEN)
})

it("reserves no notice row when this document has no Coach state", () => {
  const { container } = render(<WritingProposalCard docId={DOC} />)
  expect(
    container.querySelector('[data-slot="writing-proposal-notice"]')
  ).toBeNull()
})

it.each(["approved", "undone"])(
  "keeps the %s notice row while the person types",
  async (phase) => {
    publishWritingProposal("call-1", {
      docId: DOC,
      edits: [{ op: "replaceText", before: "Before", after: "After" }],
    })
    attachWritingProposal("call-1", PENDING)
    syncWritingProposalFromActions(
      [
        {
          toolCallId: "call-1",
          operation: "paper.edit",
          state: "committed",
          activityId: "activity-1",
          proposalId: PENDING,
          input: { docId: DOC },
        },
      ],
      []
    )
    if (phase === "undone") noteWritingUndo("activity-1")
    const text = phase === "undone" ? "Before" : "After"
    storeDraft(DOC, draft(text), localStorage, {
      revision: REVISION,
      words: text,
    })
    const onText = vi.fn()
    const view = (words: string) => (
      <>
        <WritingProposalCard docId={DOC} />
        <WritingDocumentNoticeSync docId={DOC} text={words} onText={onText} />
      </>
    )
    const { rerender } = render(view(text))
    const row = screen.getByRole("region", { name: "Coach proposal" })
    await waitFor(() => expect(onText).toHaveBeenLastCalledWith(text))
    rerender(view(`${text} M`))
    await waitFor(() => expect(onText).toHaveBeenLastCalledWith(`${text} M`))
    expect(screen.getByRole("region", { name: "Coach proposal" })).toBe(row)
    expect(row).toHaveClass("min-h-24", "md:min-h-16")
    expect(within(row).getByRole("status")).toHaveTextContent(
      `Coach's change ${phase}`
    )
  }
)

it("reads explicit document text for notices instead of the stored draft", async () => {
  storeDraft(DOC, draft(""), localStorage)
  rememberStoppedLetter({
    docId: DOC,
    chatId: "stopped-chat",
    prompt: "Draft a letter",
    jobId: null,
  })
  const onText = vi.fn()
  const { rerender } = render(
    <WritingDocumentNoticeSync docId={DOC} text="" onText={onText} />
  )
  await waitFor(() => expect(onText).toHaveBeenCalledWith(""))
  expect(stoppedLetter()?.docId).toBe(DOC)
  rerender(
    <WritingDocumentNoticeSync
      docId={DOC}
      text="My live opening"
      onText={onText}
    />
  )
  await waitFor(() => expect(stoppedLetter()).toBeNull())
  expect(onText).toHaveBeenLastCalledWith("My live opening")
})
