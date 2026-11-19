import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"

import {
  CoachParts,
  partRenderers,
} from "@/features/coach/coach-part-renderers.tsx"
import { toCoachParts, type CoachPart } from "@/features/coach/coach-parts.ts"

afterEach(() => {
  cleanup()
})

const updated = {
  type: "tool" as const,
  name: "paper.replace",
  summary: "Updated the CV",
  ok: true,
  toolCallId: "call-1",
  detail: {
    type: "paper.replace" as const,
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
    expect(screen.getByText("PM track CV")).toBeInTheDocument()
    expect(screen.getByText("1 change applied")).toBeInTheDocument()
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
