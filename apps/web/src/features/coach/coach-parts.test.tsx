import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"

import {
  CoachParts,
  partRenderers,
} from "@/features/coach/coach-part-renderers.tsx"
import {
  partFromCoachEvent,
  resultFromApprove,
} from "@/features/coach/coach-api.ts"
import {
  groupCoachParts,
  toCoachParts,
  type CoachPart,
} from "@/features/coach/coach-parts.ts"

afterEach(() => {
  cleanup()
})

const updated = {
  type: "tool" as const,
  name: "paper_updateContent",
  summary: "Updated the CV",
  ok: true,
  toolCallId: "call-1",
  detail: {
    type: "paper.updateContent" as const,
    docKind: "cv" as const,
    docName: "PM track CV",
    hunks: [
      {
        sectionId: "s1",
        section: "Summary",
        lines: [
          { kind: "del" as const, text: "Old summary" },
          { kind: "add" as const, text: "New summary" },
        ],
      },
    ],
  },
}

const ctx = { canUndo: false }

describe("step and confirm parts", () => {
  it("maps a step, a confirm, and a document result", () => {
    expect(partFromCoachEvent("step", { label: "List jobs" })).toEqual({
      kind: "step",
      label: "List jobs",
    })
    expect(
      partFromCoachEvent("confirm", {
        pendingActionId: "pending-1",
        command: "paper.replace",
        summary: "Update the document",
      })
    ).toEqual({
      kind: "confirm",
      pendingActionId: "pending-1",
      command: "paper.replace",
      summary: "Update the document",
    })
    expect(
      partFromCoachEvent("tool-result", {
        name: "paper.replace",
        summary: "Update the document",
        detail: {
          type: "paper.updateContent",
          docKind: "letter",
          docName: "Coach note",
          hunks: [],
        },
        result: {
          ok: true,
          data: { id: "11111111-1111-7111-8111-111111111111" },
        },
      })
    ).toMatchObject({
      kind: "result",
      name: "Coach note",
      docId: "11111111-1111-7111-8111-111111111111",
    })
  })

  it("copies the replace change count from an approve row", () => {
    expect(
      resultFromApprove({
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        summary: "Updated Coach note",
        subjectId: "11111111-1111-7111-8111-111111111111",
        detail: {
          docId: "11111111-1111-7111-8111-111111111111",
          name: "Coach note",
          changes: 1,
        },
      })
    ).toMatchObject({
      kind: "result",
      name: "Coach note",
      summary: "Updated Coach note",
      changes: 1,
    })
  })
})

describe("toCoachParts", () => {
  it("derives text, tool and diff parts in the order the Coach produced them", () => {
    const parts = toCoachParts({
      id: "c1",
      role: "coach",
      text: "Done.",
      parts: [{ type: "text", text: "Done." }, updated],
    })

    expect(parts.map((part) => part.kind)).toEqual(["text", "tool", "diff"])
  })

  it("marks a failed step as error and skips the diff for it", () => {
    const parts = toCoachParts({
      id: "c1",
      role: "coach",
      text: "",
      parts: [{ ...updated, ok: false, summary: "Card not found" }],
    })

    expect(parts).toHaveLength(1)
    expect(parts[0]).toMatchObject({ kind: "tool", status: "error" })
  })

  it("groups only adjacent tool steps", () => {
    const parts = toCoachParts({
      id: "c1",
      role: "coach",
      text: "",
      parts: [
        { ...updated, detail: undefined },
        { ...updated, toolCallId: "call-2", detail: undefined },
        { type: "text", text: "Then I wrote." },
      ],
    })

    expect(groupCoachParts(parts).map((block) => block.type)).toEqual([
      "tools",
      "part",
    ])
  })
})

describe("partRenderers", () => {
  it("renders one of each CoachPart kind", () => {
    const [text, tool, diff] = toCoachParts({
      id: "c1",
      role: "coach",
      text: "Done.",
      parts: [{ type: "text", text: "Plain **bold** text" }, updated],
    }) as [CoachPart, CoachPart, CoachPart]

    render(
      <div>
        {text.kind === "text" ? partRenderers.text({ part: text, ctx }) : null}
        {tool.kind === "tool" ? partRenderers.tool({ part: tool, ctx }) : null}
        {diff.kind === "diff" ? partRenderers.diff({ part: diff, ctx }) : null}
      </div>
    )

    expect(screen.getByText("bold").closest("strong")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /Updated CV PM track CV/ })
    ).toBeInTheDocument()
    expect(screen.getByText("New summary")).toBeInTheDocument()
    expect(screen.getByText("Old summary")).toBeInTheDocument()
  })

  it("draws a diff without a green fill", () => {
    const parts = toCoachParts({
      id: "c1",
      role: "coach",
      text: "",
      parts: [updated],
    })
    const { container } = render(<CoachParts parts={parts} ctx={ctx} />)

    expect(container.innerHTML).not.toMatch(/(?:bg|text)-success/)
    expect(container.querySelector("ins")).toHaveTextContent("New summary")
    expect(container.querySelector("del")).toHaveTextContent("Old summary")
  })
})
