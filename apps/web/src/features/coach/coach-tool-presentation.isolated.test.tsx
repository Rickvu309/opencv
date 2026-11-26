import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    params,
    className,
    children,
  }: {
    params?: { docId?: string }
    className?: string
    children?: unknown
  }) => (
    <a
      href={params?.docId ? `/paper/${params.docId}` : ""}
      className={className}
    >
      {children as never}
    </a>
  ),
}))
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import type { ChatToolPart } from "@workspace/domain/coach"
import * as contractClient from "@/lib/contract-client.ts"
import type { ReactElement } from "react"
import { ChatStoreContext } from "./chat-store-context.ts"
import { render as renderWithClient } from "@/test/render-with-client.tsx"
import { CoachToolLine } from "./coach-tool-line.tsx"
import { CoachParts } from "./coach-part-renderers.tsx"
import { toCoachParts, type CoachToolPart } from "./coach-parts.ts"
import { documentEditDetail, documentEditReceiptType } from "./coach-receipt.ts"

beforeEach(() => {
  vi.spyOn(contractClient.catalogClient, "run").mockResolvedValue(null)
  vi.spyOn(contractClient, "refreshReads").mockResolvedValue([])
})

function render(ui: ReactElement) {
  return renderWithClient(
    <ChatStoreContext.Provider
      value={{
        chats: [],
        chatsLoaded: true,
        activeChatId: null,
        navigationRevision: 0,
        creationOwner: null,
        messages: [],
        phase: "idle",
        progress: { active: false, rows: [] },
        error: null,
        send: () => false,
        stop: () => {},
        retry: () => false,
        regenerate: () => false,
        undo: async () => {},
        openChat: () => {},
        newChat: () => {},
        deleteChat: async () => {},
      }}
    >
      {ui}
    </ChatStoreContext.Provider>
  )
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const edited: ChatToolPart = {
  type: "tool",
  name: "paper.edit",
  summary: "Ran paper.edit",
  ok: true,
  toolCallId: "call-edit",
  activityId: "activity-edit",
  detail: {
    type: documentEditReceiptType,
    docId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    docKind: "cv",
    docName: "Untitled CV",
    hunks: [
      {
        sectionId: "summary",
        section: "Summary",
        lines: [
          { kind: "del", text: "I worked on support." },
          { kind: "add", text: "I helped customers resolve support requests." },
        ],
      },
    ],
  },
  reversal: { possible: true, description: "Restore the previous text." },
}

const pending: ChatToolPart = {
  ...edited,
  pendingActionId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  approval: "pending",
}

function toolOf(part: ChatToolPart): CoachToolPart {
  const tool = toCoachParts({
    id: "coach",
    role: "coach",
    text: "",
    parts: [part],
  }).find((part) => part.kind === "tool")
  if (!tool || tool.kind !== "tool") throw new Error("Expected tool")
  return tool
}

describe("Coach approval presentation", () => {
  it("shows a named proposal and prose diff before the primary Approve button", () => {
    const { container } = render(
      <CoachToolLine tool={toolOf(pending)} canUndo />
    )
    expect(screen.getByRole("heading", { name: "Untitled CV" })).toBeVisible()
    expect(screen.getByText("1 change to approve")).toBeVisible()
    expect(screen.getByText("Before")).toBeVisible()
    expect(screen.getByText("After")).toBeVisible()
    expect(screen.getByText("I worked on support.").tagName).toBe("DEL")
    const insertion = screen.getByText(
      "I helped customers resolve support requests."
    )
    expect(insertion.tagName).toBe("INS")
    const [approve, deny] = screen.getAllByRole("button")
    expect(approve).toHaveTextContent("Approve")
    expect(deny).toHaveTextContent("Deny")
    expect(approve).toHaveAttribute("data-variant", "primary")
    expect(approve).toHaveClass("h-11", "md:h-8", "bg-primary", "font-semibold")
    expect(deny).toHaveAttribute("data-variant", "default")
    expect(deny).toHaveClass("h-11", "md:h-8")
    expect(deny.className).toContain("ring-border")
    expect(insertion.compareDocumentPosition(approve)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )
    expect(container.querySelector("[data-running], code, pre")).toBeNull()
    expect(container.textContent).not.toMatch(
      /paper\.edit|Working|\d+s|Edited Untitled/
    )
  })

  it("explains the missing proposal when the current contract carries no input or document metadata", () => {
    render(
      <CoachToolLine
        tool={toolOf({ ...pending, detail: undefined })}
        canUndo={false}
      />
    )
    expect(screen.getByRole("heading", { name: "Your document" })).toBeVisible()
    expect(
      screen.getByText(/The proposed words are not available in this Chat/)
    ).toHaveTextContent("Open the document in Paper")
  })

  it.each([true, false])(
    "locks both decisions and leaves only the %s decision after success",
    async (approve) => {
      const command = vi.mocked(contractClient.catalogClient.run)
      const complete = command.getMockImplementation()
      if (!complete) throw new Error("Expected command mock")
      command.mockImplementationOnce((...args) => {
        fireEvent.click(
          screen.getByRole("button", { name: approve ? "Deny" : "Approve" })
        )
        return complete(...args)
      })
      const { container } = render(
        <CoachToolLine tool={toolOf(pending)} canUndo={false} />
      )
      fireEvent.click(
        screen.getByRole("button", { name: approve ? "Approve" : "Deny" })
      )
      await waitFor(() =>
        expect(container.textContent).toBe(
          approve ? "Approved" : "Denied. Nothing changed."
        )
      )
      expect(command).toHaveBeenCalledTimes(1)
      expect(command.mock.calls[0]?.[1]).toBe(
        approve ? "actions.approve" : "actions.deny"
      )
      expect(command.mock.calls[0]?.[2]).toEqual({
        pendingActionId: pending.pendingActionId,
      })
      expect(screen.queryByRole("button")).not.toBeInTheDocument()
    }
  )

  it.each(["approved", "denied"] as const)(
    "restores a saved %s decision as one quiet line",
    (approval) => {
      const { container } = render(
        <CoachToolLine
          tool={toolOf({ ...pending, approval })}
          canUndo={false}
        />
      )
      expect(container.textContent).toBe(
        approval === "approved" ? "Approved" : "Denied. Nothing changed."
      )
    }
  )

  it.each([
    ["denied", "Denied. Nothing changed."],
    ["expired", "Expired. Ask Coach again."],
    ["stopped", "Stopped. Ask Coach again."],
  ] as const)(
    "keeps one quiet line when the task snapshot marks a proposal %s without its pending id",
    (approval, line) => {
      const { container } = render(
        <CoachToolLine
          tool={toolOf({
            ...pending,
            pendingActionId: undefined,
            ok: false,
            summary: "Edit the document",
            approval,
          })}
          canUndo
        />
      )
      expect(container.textContent).toBe(line)
      expect(screen.queryByText("Failed")).not.toBeInTheDocument()
      expect(screen.queryByText("Nothing changed.")).not.toBeInTheDocument()
      expect(screen.queryByRole("button")).not.toBeInTheDocument()
    }
  )
})

describe("Coach trace and receipts", () => {
  it("renders adjacent reads as muted lines without an empty tool group", () => {
    const parts = toCoachParts({
      id: "coach",
      role: "coach",
      text: "",
      parts: [
        { type: "tool", name: "job.list", ok: true, summary: "Ran job.list" },
        {
          type: "tool",
          name: "paper.list",
          ok: true,
          summary: "Ran paper.list",
        },
      ],
    })
    const { container } = render(
      <CoachParts parts={parts} ctx={{ canUndo: false }} />
    )
    expect(screen.getByText("Looked at your Jobs")).toHaveClass(
      "text-muted-foreground"
    )
    expect(screen.getByText("Looked at your Paper")).toBeVisible()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
    expect(container.textContent).not.toMatch(/job\.list|paper\.list|Used \d/)
  })

  it("keeps the title, Open and Undo together and the diff in body text", () => {
    const parts = toCoachParts({
      id: "coach",
      role: "coach",
      text: "",
      parts: [edited],
    })
    const { container } = render(
      <CoachParts parts={parts} ctx={{ canUndo: true, onUndo: vi.fn() }} />
    )
    const title = screen.getByText("Untitled CV")
    const row = title.closest<HTMLElement>("[data-slot=action-card]")
    if (!row) throw new Error("Expected receipt row")
    expect(within(row).getByRole("link", { name: "Open" })).toHaveAttribute(
      "href",
      `/paper/${documentEditDetail(edited.detail)?.docId ?? ""}`
    )
    expect(within(row).getByRole("button", { name: /^Undo/ })).toBeEnabled()
    expect(
      container.querySelector("ins")?.parentElement?.parentElement
    ).toHaveClass("font-sans")
    expect(container.querySelector("ins")).toHaveClass(
      "bg-chart-2/10",
      "text-[color:color-mix(in_oklab,var(--chart-2)_65%,var(--foreground))]"
    )
    expect(container.querySelector("del")).toHaveClass(
      "line-through",
      "text-[color:color-mix(in_oklab,var(--destructive)_80%,var(--foreground))]"
    )
    expect(container.querySelector("pre, code")).toBeNull()
    expect(container.querySelectorAll("ins")).toHaveLength(1)
    expect(container.textContent).not.toMatch(/Edited CV Untitled|Reversible/)
  })

  it("keeps the document record with Open and an Undone state after reversal, without the diff or Undo", () => {
    const parts = toCoachParts({
      id: "coach",
      role: "coach",
      text: "",
      parts: [{ ...edited, undone: true }],
    })
    const { container } = render(
      <CoachParts parts={parts} ctx={{ canUndo: true }} />
    )
    const record = container.querySelector("[data-slot=action-card]")
    expect(record).toHaveAttribute("data-state", "undone")
    expect(within(record as HTMLElement).getByText("Untitled CV")).toBeVisible()
    expect(screen.getByText("1 change undone")).toBeVisible()
    expect(record?.textContent).not.toMatch(/Edited|Applied/)
    expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute(
      "href",
      "/paper/cccccccc-cccc-4ccc-8ccc-cccccccccccc"
    )
    expect(container.querySelectorAll("ins, del")).toHaveLength(0)
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("says a step still waits on the person when it has no decision yet", () => {
    render(
      <CoachToolLine
        tool={toolOf({
          type: "tool",
          name: "job.move",
          summary: "Move this Job",
          ok: true,
          approval: "pending",
        })}
        canUndo
      />
    )
    expect(screen.getByRole("heading", { name: "Move this Job" })).toBeVisible()
    expect(screen.getByText("Needs your approval")).toBeVisible()
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull()
  })

  it("names every Undo by its step when a reply holds more than one step", async () => {
    const onUndo = vi.fn().mockResolvedValue(undefined)
    const move: ChatToolPart = {
      type: "tool",
      name: "job.move",
      summary: "Moved this Job to Prep",
      ok: true,
      toolCallId: "call-move",
      activityId: "activity-move",
      reversal: { possible: true, description: "Move it back." },
    }
    const failed: ChatToolPart = {
      type: "tool",
      name: "job.move",
      summary: "Card not found",
      ok: false,
      toolCallId: "call-failed",
    }
    render(
      <CoachParts
        parts={toCoachParts({
          id: "coach",
          role: "coach",
          text: "",
          parts: [move, failed],
        })}
        ctx={{ canUndo: true, onUndo }}
      />
    )
    expect(screen.getByText("Failed. Nothing changed.")).toBeVisible()
    fireEvent.click(
      screen.getByRole("button", { name: "Undo: Moved this Job to Prep" })
    )
    await waitFor(() => expect(onUndo).toHaveBeenCalledWith("activity-move"))
    expect(screen.getAllByRole("button", { name: /^Undo/ })).toHaveLength(1)
  })

  it("keeps an applied Word edit as one record that names the document and keeps Open after Undo", () => {
    const word: ChatToolPart = {
      type: "tool",
      name: "paper.edit",
      summary: "Edited CV.docx",
      ok: true,
      toolCallId: "call-word",
      activityId: "activity-word",
      reversal: {
        possible: true,
        description: "Edited CV.docx",
        input: {
          doc: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          restore: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
          revision: "ffffffff-ffff-4fff-8fff-ffffffffffff",
        },
      },
    }
    const applied = render(
      <CoachParts
        parts={toCoachParts({
          id: "c",
          role: "coach",
          text: "",
          parts: [word],
        })}
        ctx={{ canUndo: true, onUndo: vi.fn() }}
      />
    )
    const record = applied.container.querySelector("[data-slot=action-card]")
    expect(record).toHaveAttribute("data-state", "applied")
    expect(within(record as HTMLElement).getByText("CV.docx")).toBeVisible()
    expect(
      within(record as HTMLElement).getByText("Edit applied")
    ).toBeVisible()
    expect(applied.container.textContent).not.toMatch(/Reversible/)
    expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled()
    applied.unmount()
    render(
      <CoachParts
        parts={toCoachParts({
          id: "c",
          role: "coach",
          text: "",
          parts: [{ ...word, undone: true, outcome: "undone" }],
        })}
        ctx={{ canUndo: true, onUndo: vi.fn() }}
      />
    )
    expect(screen.getByText("CV.docx")).toBeVisible()
    expect(screen.getByText("Edit undone")).toBeVisible()
    expect(screen.queryByText(/Edited/)).toBeNull()
    expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute(
      "href",
      "/paper/dddddddd-dddd-4ddd-8ddd-dddddddddddd"
    )
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull()
  })
})
