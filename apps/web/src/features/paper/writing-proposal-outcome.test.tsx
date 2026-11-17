import "fake-indexeddb/auto"

import { afterEach, expect, it, vi } from "vitest"
import { act, cleanup, screen, within } from "@testing-library/react"

import { render } from "@/test/render-with-client.tsx"
import { closeWritingDb } from "@/features/paper-page/canvas-save.ts"
import {
  notifyWritingRefresh,
  subscribeWritingRefresh,
} from "@/lib/writing-refresh.ts"
import {
  attachWritingProposal,
  clearWritingProposal,
  noteWritingUndo,
  publishWritingProposal,
  syncWritingProposalFromActions,
  writingOutcome,
  writingProposal,
} from "@/lib/writing-proposal.ts"
import { WritingPage } from "./writing-page.tsx"

const DOC = "11111111-1111-4111-8111-111111111111"
const PARAGRAPH = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const REVISION = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const PENDING = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"

function draft(text: string) {
  return {
    blocks: [{ id: PARAGRAPH, text }],
    caret: { blockId: PARAGRAPH, offset: 0 },
    nextId: 2,
  }
}

function readPage(text: string) {
  return {
    doc: DOC,
    revision: REVISION,
    name: "Page.docx",
    label: "letter",
    paragraphs: [
      {
        handle: PARAGRAPH,
        text,
        pieces: [{ text, editable: true }],
        held: false,
        message: "",
        code: null,
      },
    ],
  }
}

afterEach(async () => {
  clearWritingProposal()
  localStorage.clear()
  cleanup()
  vi.unstubAllGlobals()
  await closeWritingDb()
})

it("shows Approved, then Undone, after the panel settles the change", async () => {
  vi.stubGlobal("fetch", async () =>
    Response.json({ ok: true, data: readPage("Before line") })
  )
  publishWritingProposal("call-1", {
    docId: DOC,
    basedOn: REVISION,
    edits: [{ op: "replaceText", before: "Before line", after: "After line" }],
  })
  attachWritingProposal("call-1", PENDING)
  render(<WritingPage docId={DOC} seed={draft("Before line")} />)
  const proposal = await screen.findByRole("region", { name: "Coach proposal" })
  act(() => notifyWritingRefresh())
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
  expect(within(proposal).getByRole("status")).toHaveTextContent("Approved")
  const seen: string[] = []
  const stop = subscribeWritingRefresh(() => seen.push("refresh"))
  act(() => noteWritingUndo("activity-1"))
  stop()
  expect(writingOutcome()).toEqual({
    docId: DOC,
    pendingActionId: PENDING,
    activityId: "activity-1",
    phase: "undone",
  })
  expect(seen).toEqual(["refresh"])
  expect(within(proposal).getByRole("status")).toHaveTextContent("Undone")
})

function propose() {
  publishWritingProposal("call-1", {
    docId: DOC,
    edits: [{ op: "replaceText", before: "Before", after: "After" }],
  })
  attachWritingProposal("call-1", PENDING)
}

it("does not turn refresh followed by Deny into an approval", () => {
  propose()
  notifyWritingRefresh()
  syncWritingProposalFromActions(
    [
      {
        toolCallId: "call-1",
        operation: "paper.edit",
        state: "proposed",
        proposalId: PENDING,
        input: { docId: DOC },
      },
    ],
    [{ id: PENDING, status: "denied", input: {} }]
  )
  expect(writingProposal()).toBeNull()
  expect(writingOutcome()).toBeNull()
})

it("clears a proposal that disappears without a commit", () => {
  propose()
  notifyWritingRefresh()
  syncWritingProposalFromActions([], [])
  expect(writingProposal()).toBeNull()
  expect(writingOutcome()).toBeNull()
})

it("requires the proposal's own committed action and activity", () => {
  propose()
  syncWritingProposalFromActions(
    [
      {
        toolCallId: "other-call",
        operation: "paper.edit",
        state: "committed",
        proposalId: "other-proposal",
        activityId: "other-activity",
        input: { docId: DOC },
      },
    ],
    []
  )
  expect(writingOutcome()).toBeNull()
})

it("ignores Undo for another activity or document", () => {
  propose()
  syncWritingProposalFromActions(
    [
      {
        toolCallId: "call-1",
        operation: "paper.edit",
        state: "committed",
        proposalId: PENDING,
        activityId: "activity-1",
        input: { docId: DOC },
      },
    ],
    []
  )
  noteWritingUndo("another-activity")
  expect(writingOutcome()?.phase).toBe("approved")
  noteWritingUndo("activity-1")
  expect(writingOutcome()?.phase).toBe("undone")
  syncWritingProposalFromActions(
    [
      {
        toolCallId: "call-1",
        operation: "paper.edit",
        state: "committed",
        proposalId: PENDING,
        activityId: "activity-1",
        input: { docId: DOC },
      },
    ],
    []
  )
  expect(writingOutcome()?.phase).toBe("undone")
})
