import { afterEach, describe, expect, it } from "vitest"
import { cleanup, screen, within } from "@testing-library/react"
import type { ChatToolPart } from "@workspace/domain"

import { CoachToolLine } from "@/features/coach/coach-tool-line.tsx"
import {
  ChatStoreContext,
  type ChatStoreValue,
} from "@/features/coach/chat-store-context.ts"
import {
  toCoachParts,
  type CoachToolPart,
} from "@/features/coach/coach-parts.ts"
import { WritingProposalCard } from "@/features/paper/writing-proposal.tsx"
import {
  clearWritingProposal,
  syncWritingProposalFromActions,
  WORD_BATCH_HIDDEN,
} from "@/lib/writing-proposal.ts"
import { render } from "@/test/render-with-client.tsx"

const DOC = "11111111-1111-4111-8111-111111111111"
const REVISION = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const PENDING = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
const HANDLE = "33333333-3333-4333-8333-333333333333"
const OTHER = "44444444-4444-4444-8444-444444444444"

const store = {
  chats: [],
  activeChatId: null,
  navigationRevision: 0,
  creationOwner: null,
  messages: [],
  phase: "idle",
  progress: { active: false, rows: [] },
  error: null,
  send: () => false,
  stop: () => undefined,
  retry: () => false,
  regenerate: () => false,
  undo: async () => undefined,
  openChat: () => undefined,
  newChat: () => undefined,
  deleteChat: async () => undefined,
} satisfies ChatStoreValue

const input = {
  docId: DOC,
  basedOn: REVISION,
  edits: [
    { op: "setText", handle: HANDLE, text: "Dear Grace," },
    { op: "insert", after: HANDLE, text: "I write about the role." },
    { op: "delete", handle: OTHER },
  ],
}

function reviewOf(place: string | null | undefined) {
  return {
    docId: DOC,
    basedOn: REVISION,
    operations: [
      { op: "setText" as const, before: "Dear Ada,", after: "Dear Grace," },
      {
        op: "insert" as const,
        before: "",
        after: "I write about the role.",
        ...(place === undefined ? {} : { place }),
      },
      { op: "delete" as const, before: "Old line", after: "" },
    ],
  }
}

function toolOf(review: unknown): CoachToolPart {
  const part: ChatToolPart = {
    type: "tool",
    name: "paper.edit",
    summary: "Edit the document",
    ok: true,
    toolCallId: "call-batch",
    pendingActionId: PENDING,
    approval: "pending",
    review,
  }
  const found = toCoachParts({
    id: "m1",
    role: "coach",
    text: "",
    parts: [part],
  }).find((item) => item.kind === "tool")
  if (!found || found.kind !== "tool") throw new Error("no tool part")
  return found
}

function publish(review: ReturnType<typeof reviewOf>) {
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
    [{ id: PENDING, status: "pending", input, review }]
  )
}

function renderBoth(review: ReturnType<typeof reviewOf>) {
  publish(review)
  render(
    <ChatStoreContext.Provider value={store}>
      <CoachToolLine tool={toolOf(review)} canUndo={false} />
      <WritingProposalCard docId={DOC} onApplied={async () => undefined} />
    </ChatStoreContext.Provider>
  )
}

afterEach(() => {
  clearWritingProposal()
  cleanup()
})

describe("a Word batch is shown before Approve", () => {
  it("shows the setText, insert and delete words on both surfaces before Approve is enabled", () => {
    renderBoth(reviewOf("Dear Ada,"))

    const card = screen.getByRole("region", { name: "Coach proposal" })
    const coach = screen.getByText("This change").closest("[data-slot=card]")
    if (!coach) throw new Error("missing batch preview")
    for (const surface of [card, coach]) {
      expect(within(surface).getByText("Change a line")).toBeVisible()
      expect(within(surface).getByText("Add a line")).toBeVisible()
      expect(within(surface).getByText("Remove a line")).toBeVisible()
      expect(
        within(surface).getByText("After this line: Dear Ada,")
      ).toBeVisible()
    }
    expect(within(card).getByText("Dear Ada,")).toBeVisible()
    expect(within(card).getByText("Dear Grace,")).toBeVisible()
    expect(within(card).getByText("I write about the role.")).toBeVisible()
    expect(within(card).getByText("Old line")).toBeVisible()
    expect(within(coach).getByText("Before Dear Ada,")).toBeVisible()
    expect(within(coach).getByText("After Dear Grace,")).toBeVisible()
    expect(
      within(coach).getByText("After I write about the role.")
    ).toBeVisible()
    expect(within(coach).getByText("Before Old line")).toBeVisible()
    const approve = screen.getAllByRole("button", { name: "Approve" })
    expect(approve).toHaveLength(2)
    for (const button of approve) expect(button).toBeEnabled()
  })

  it("offers no Approve when an operation cannot be shown", () => {
    renderBoth(reviewOf(undefined))

    expect(screen.getAllByText(WORD_BATCH_HIDDEN)).toHaveLength(2)
    expect(
      screen.queryByRole("button", { name: "Approve" })
    ).not.toBeInTheDocument()
  })
})
