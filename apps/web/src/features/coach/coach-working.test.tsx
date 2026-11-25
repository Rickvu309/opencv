import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen, within } from "@testing-library/react"

import { ChatLog } from "@/components/ai-elements/chat.tsx"
import { STREAMING_COACH_ID } from "@/features/coach/chat-messages.ts"
import type { ChatViewMessage } from "@/features/coach/chat-messages.ts"
import { CoachTurns } from "@/features/coach/coach-turns.tsx"
import type { CoachTurnProgress } from "@/features/coach/coach-progress.ts"
import { CoachWorkFold } from "@/features/coach/coach-work-fold.tsx"

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

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
      name: "paper.read",
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
  it("shows a calm breathing Working label without a running timer", () => {
    const { container } = render(<CoachWorkFold steps={[]} live announce />)
    expect(screen.getByRole("status")).toHaveTextContent("Working")
    const label = container.querySelector(
      "[data-slot='coach-work-label'] > span"
    )
    expect(label).toHaveTextContent("Working")
    expect(label?.className).toContain("motion-safe:animate-pulse")
    expect(container.querySelector(".coach-shimmer")).toBeNull()
    expect(screen.queryByText(/Working, \ds/)).not.toBeInTheDocument()
  })

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

  it("tells a declined step apart from a failed one, in words and icon", () => {
    const { container } = render(
      <CoachWorkFold
        live
        steps={[
          { id: "x", label: "Edit your Paper", status: "declined" },
          { id: "y", label: "List jobs", status: "failed" },
        ]}
      />
    )
    expect(
      within(screen.getByRole("list", { name: "Coach progress" }))
        .getAllByRole("listitem")
        .map((item) => item.textContent)
    ).toEqual([
      "Edit your Paper, not approved, nothing changed",
      "List jobs, failed",
    ])
    const icons = [
      ...container.querySelectorAll("[data-slot='coach-step-icon'] svg"),
    ].map((icon) => icon.outerHTML)
    expect(icons[0]).not.toBe(icons[1])
  })

  it("draws the same Coach mark on every finished fold, whatever the step count", () => {
    const step = (id: string) => ({
      id,
      label: "Read document",
      status: "completed" as const,
    })
    const mark = (count: number) => {
      const { container, unmount } = render(
        <CoachWorkFold
          live={false}
          workedMs={2000}
          steps={Array.from({ length: count }, (_, index) => step(`s${index}`))}
        />
      )
      const html = container.querySelector(
        "[data-slot='coach-work-head'] > svg"
      )?.outerHTML
      unmount()
      return html
    }
    expect(mark(1)).toBeDefined()
    expect(mark(1)).toBe(mark(2))
    expect(mark(2)).toBe(mark(3))
  })

  it("folds Working shut above the reply once the Coach has written text and nothing is running", () => {
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
    const fold = container.querySelector("[data-slot='coach-working']")
    expect(fold).not.toBeNull()
    expect(
      within(fold as HTMLElement).getByRole("button", { name: "Working" })
    ).toHaveAttribute("aria-expanded", "false")
    expect(
      container.querySelectorAll("[data-slot='coach-progress-row']")
    ).toHaveLength(0)
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })

  it("opens the fold for calls still running after text, without announcing Working", () => {
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
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Working" })).toHaveAttribute(
      "aria-expanded",
      "true"
    )
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
