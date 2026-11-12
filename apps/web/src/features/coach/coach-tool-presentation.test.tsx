import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import type { ChatToolPart } from "@workspace/domain"
import {
  ToolCallCard,
  ToolCallGroup,
} from "@workspace/ui/components/tool-call-card"
import * as contractClient from "@/lib/contract-client.ts"
import { runContractCommand } from "@/lib/contract-client.ts"
import type { ReactElement } from "react"
import { ChatStoreContext } from "./chat-store-context.ts"
import { render as renderWithClient } from "@/test/render-with-client.tsx"
import { toolCardProps } from "./coach-tool-card.ts"
import { CoachToolLine } from "./coach-tool-line.tsx"
import { CoachParts } from "./coach-part-renderers.tsx"
import { toCoachParts, type CoachToolPart } from "./coach-parts.ts"

beforeEach(() => {
  vi.spyOn(contractClient, "runContractCommand").mockResolvedValue(undefined)
  vi.spyOn(contractClient, "refreshReads").mockResolvedValue(undefined)
})

function render(ui: ReactElement) {
  return renderWithClient(
    <ChatStoreContext.Provider
      value={{
        chats: [],
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
    type: "paper.replace",
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
    expect(
      screen.getByRole("heading", { name: "Coach wants to edit Untitled CV" })
    ).toBeVisible()
    expect(screen.getByText("Needs your approval")).toBeVisible()
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
    expect(
      container.querySelector("[data-running], .ui-tcc__spinner, code, pre")
    ).toBeNull()
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
    expect(
      screen.getByRole("heading", { name: "Coach wants to edit your document" })
    ).toBeVisible()
    expect(
      screen.getByText(/The proposed words are not available in this Chat/)
    ).toHaveTextContent("Open the document in Paper")
  })

  it.each([true, false])(
    "locks both decisions and leaves only the %s decision after success",
    async (approve) => {
      const command = vi.mocked(runContractCommand)
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
          approve ? "Approved" : "Denied · nothing changed"
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
        approval === "approved" ? "Approved" : "Denied · nothing changed"
      )
    }
  )

  it.each([
    ["denied", "Denied · nothing changed"],
    ["expired", "Expired · ask Coach again"],
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
    const title = screen.getByText("Edited Untitled CV · 1 change")
    const row = title.parentElement
    if (!row) throw new Error("Expected receipt row")
    expect(within(row).getByRole("link", { name: "Open" })).toHaveAttribute(
      "href",
      `/paper/${edited.detail?.type === "paper.replace" ? edited.detail.docId : ""}`
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

  it("leaves one Undone line after reversal without the old receipt or diff", () => {
    const parts = toCoachParts({
      id: "coach",
      role: "coach",
      text: "",
      parts: [{ ...edited, undone: true }],
    })
    const { container } = render(
      <CoachParts parts={parts} ctx={{ canUndo: true }} />
    )
    expect(container.textContent).toBe("Undone")
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("shows a Word batch in the diff look directly above the solid Approve", () => {
    const { container } = render(
      <CoachToolLine
        tool={toolOf({
          ...pending,
          detail: undefined,
          review: {
            docId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            basedOn: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            operations: [
              { op: "setText", before: "Dear Ada,", after: "Dear Grace," },
              { op: "delete", before: "Old line", after: "" },
            ],
          },
        })}
        canUndo={false}
      />
    )
    const deleted = screen.getByText("Dear Ada,")
    const inserted = screen.getByText("Dear Grace,")
    expect(deleted.tagName).toBe("DEL")
    expect(inserted.tagName).toBe("INS")
    expect(screen.getByText("Old line").tagName).toBe("DEL")
    const diffLine = container.querySelector("[aria-label^='Changes in'] del")
    expect(diffLine).toBeNull()
    const sameLook = render(
      <CoachToolLine tool={toolOf(pending)} canUndo={false} />
    ).container
    expect(deleted.className).toBe(sameLook.querySelector("del")?.className)
    expect(inserted.className).toBe(sameLook.querySelector("ins")?.className)
    sameLook.remove()
    const approve = screen.getByRole("button", { name: "Approve" })
    expect(approve).toHaveAttribute("data-variant", "primary")
    expect(inserted.compareDocumentPosition(approve)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )
    expect(screen.getByText("Changes to approve")).toBeVisible()
    expect(container.textContent).not.toMatch(/not available in this Chat/)
  })

  it("maps a pending tool to awaiting and gives the kit no running timer", () => {
    expect(toolCardProps(toolOf(pending)).status).toBe("awaiting")
    const { container } = render(
      <ToolCallCard name="Edit your Paper" status="awaiting" />
    )
    expect(screen.getByText("Needs your approval")).toBeVisible()
    expect(
      container.querySelector(".ui-tcc__spinner, .ui-tcc__time")
    ).toBeNull()
  })

  it("excludes compact traces from a mixed tool group's count", () => {
    render(
      <ToolCallGroup>
        <ToolCallCard
          name="Look at your Jobs"
          status="success"
          className="hidden"
        />
        <ToolCallCard name="Move this Job" status="success" />
      </ToolCallGroup>
    )
    expect(screen.getByRole("button", { name: /Used 1 tool/ })).toBeVisible()
  })
})
