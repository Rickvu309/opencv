import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen, within } from "@testing-library/react"

import { ChatLog } from "@/components/ai-elements/chat.tsx"
import { STREAMING_COACH_ID } from "@/features/coach/chat-messages.ts"
import type { ChatViewMessage } from "@/features/coach/chat-messages.ts"
import { CoachTurns } from "@/features/coach/coach-turns.tsx"
import type { CoachTurnProgress } from "@/features/coach/coach-progress.ts"

afterEach(cleanup)

const rows: CoachTurnProgress["rows"] = [
  { id: "a", label: "Read document", status: "completed" },
  { id: "b", label: "Read document", status: "running" },
  { id: "c", label: "Move card", status: "approval" },
  { id: "d", label: "List jobs", status: "failed" },
  { id: "e", label: "Checking", status: "reported" },
]

const toolOnly: ChatViewMessage = {
  id: STREAMING_COACH_ID,
  role: "coach",
  text: "",
  parts: [
    {
      type: "tool",
      name: "paper.get",
      summary: "Read",
      ok: true,
      toolCallId: "a",
    },
  ],
}

function renderTurns(
  messages: ChatViewMessage[],
  progress?: CoachTurnProgress
) {
  return render(
    <ChatLog>
      <CoachTurns messages={messages} progress={progress} />
    </ChatLog>
  )
}

describe("Coach Working block", () => {
  it("keeps Working and its rows visible after a tool-only result", () => {
    const { container } = renderTurns([toolOnly], { active: true, rows })
    expect(
      container.querySelector("[data-slot='coach-working']")
    ).not.toBeNull()
    expect(
      [...container.querySelectorAll("[data-slot='coach-progress-row']")].map(
        (row) => row.getAttribute("data-status")
      )
    ).toEqual(["completed", "running", "failed", "reported"])
  })

  it("gives each state its own spoken note and marks only running rows busy", () => {
    renderTurns([toolOnly], { active: true, rows })
    const list = screen.getByRole("list", { name: "Coach progress" })
    const items = within(list).getAllByRole("listitem")
    expect(items.map((item) => item.textContent)).toEqual([
      "Read document, completed",
      "Read document, running",
      "List jobs, failed",
      "Checking, reported",
    ])
    expect(items.map((item) => item.getAttribute("aria-busy"))).toEqual([
      null,
      "true",
      null,
      null,
    ])
  })

  it("drops the Working header once the Coach has written text and nothing is running", () => {
    const settled = rows.filter((row) => row.status === "completed")
    const { container } = renderTurns(
      [
        {
          ...toolOnly,
          text: "Done.",
          parts: [...(toolOnly.parts ?? []), { type: "text", text: "Done." }],
        },
      ],
      { active: true, rows: settled }
    )
    expect(container.querySelector("[data-slot='coach-working']")).toBeNull()
  })

  it("keeps rows, without the header, for calls still running after text", () => {
    const { container } = renderTurns(
      [
        {
          ...toolOnly,
          text: "Checking.",
          parts: [{ type: "text", text: "Checking." }],
        },
      ],
      {
        active: true,
        rows: [{ id: "x", label: "List jobs", status: "running" }],
      }
    )
    expect(screen.queryByText(/Working, \d+s/)).toBeNull()
    expect(screen.queryByText("Working")).toBeNull()
    expect(
      [...container.querySelectorAll("[data-slot='coach-progress-row']")].map(
        (row) => row.getAttribute("data-status")
      )
    ).toEqual(["running"])
  })

  it("leaves approval to the tool card: no approval row and no Working header", () => {
    const { container } = renderTurns([toolOnly], {
      active: true,
      rows: [
        { id: "m", label: "Move card", status: "approval" },
        { id: "n", label: "List jobs", status: "completed" },
      ],
    })
    expect(
      [...container.querySelectorAll("[data-slot='coach-progress-row']")].map(
        (row) => row.getAttribute("data-status")
      )
    ).toEqual(["completed"])
    expect(screen.queryByText(/Working, \d+s/)).toBeNull()
    expect(screen.queryByText(/awaiting confirmation/)).toBeNull()
  })

  it("does not treat empty streamed text as the Coach having answered", () => {
    const { container } = renderTurns(
      [
        {
          ...toolOnly,
          parts: [...(toolOnly.parts ?? []), { type: "text", text: "  " }],
        },
      ],
      { active: true, rows }
    )
    expect(
      container.querySelector("[data-slot='coach-working']")
    ).not.toBeNull()
  })

  it("shows no old rows once the turn is no longer active", () => {
    const { container } = renderTurns([toolOnly], { active: false, rows })
    expect(container.querySelector("[data-slot='coach-working']")).toBeNull()
  })
})
