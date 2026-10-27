import { createElement, useState } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"

import { STREAMING_COACH_ID } from "@/features/home/threads.ts"
import { ThreadView } from "@/features/home/thread-view.tsx"

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn())
})

const moveReceipt = {
  type: "tool" as const,
  name: "job_move",
  summary: "Moved 'Backend Intern' to Prep",
  ok: true,
  toolCallId: "call-1",
  activityId: "activity-1",
  reversal: {
    possible: true,
    description: "Undo by moving the card back.",
    command: "apply.moveCard",
    input: { cardId: "c1", stage: "inbox" },
  },
}

const createReceipt = {
  type: "tool" as const,
  name: "paper_create",
  summary: "Created CV Untitled CV",
  ok: true,
  toolCallId: "call-2",
}

function coachTurn(
  parts: Parameters<typeof ThreadView>[0]["messages"][0]["parts"]
) {
  return {
    id: "coach-1",
    role: "coach" as const,
    text: "Moved it.",
    parts,
  }
}

describe("ThreadView thinking state", () => {
  it("shows one Thinking loader and no second shimmer while waiting", () => {
    render(createElement(ThreadView, { messages: [], waiting: true }))

    const thread = screen.getByRole("log", { name: "Thread" })
    expect(within(thread).getByRole("status")).toHaveTextContent("Thinking")
    expect(screen.queryByText("Thinking…")).not.toBeInTheDocument()
  })

  it("drops the loader once reply text is on screen and keeps no running timer", () => {
    render(
      createElement(ThreadView, {
        messages: [
          {
            id: STREAMING_COACH_ID,
            role: "coach",
            text: "Moved it and started a CV.",
            parts: [
              { type: "text", text: "Moved it and started a CV." },
              moveReceipt,
            ],
          },
        ],
      })
    )

    expect(screen.getByText("Moved it and started a CV.")).toBeInTheDocument()
    expect(screen.queryByText("Thinking")).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /Moved 'Backend Intern' to Prep/ })
    ).toHaveAttribute("aria-expanded", "false")
    expect(
      screen.getByText(/^Moved 'Backend Intern' to Prep finished/)
    ).toBeInTheDocument()
  })

  it("renders no reply actions on the live turn", () => {
    render(
      createElement(ThreadView, {
        messages: [
          {
            id: STREAMING_COACH_ID,
            role: "coach",
            text: "Working on it",
            parts: [{ type: "text", text: "Working on it" }],
          },
        ],
      })
    )

    expect(
      screen.queryByRole("button", { name: "Copy" })
    ).not.toBeInTheDocument()
  })
})

describe("ThreadView steps", () => {
  it("folds two adjacent steps into one group and keeps Undo reachable", () => {
    render(
      createElement(ThreadView, {
        messages: [coachTurn([moveReceipt, createReceipt])],
        onUndo: async () => {},
      })
    )

    const group = screen.getByRole("button", { name: /Used 2 tools/ })
    expect(group).toHaveAttribute("aria-expanded", "false")
    expect(
      screen.getByRole("button", { name: /^Undo: Moved 'Backend Intern'/ })
    ).toBeEnabled()
  })

  it("leaves a single step as its own card", () => {
    render(
      createElement(ThreadView, {
        messages: [coachTurn([moveReceipt])],
      })
    )

    expect(
      screen.queryByRole("button", { name: /Used 1 tool/ })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /Moved 'Backend Intern' to Prep/ })
    ).toBeInTheDocument()
  })

  it("shows Undone and the replacement step after an undo", async () => {
    function Harness() {
      const [undone, setUndone] = useState(false)
      const parts = undone
        ? [
            { type: "text" as const, text: "Moved it." },
            { ...moveReceipt, undone: true },
            {
              type: "tool" as const,
              name: "job_move",
              summary: "Undid the previous action",
              ok: true,
              toolCallId: "call-undo",
            },
          ]
        : [{ type: "text" as const, text: "Moved it." }, moveReceipt]
      return createElement(ThreadView, {
        messages: [coachTurn(parts)],
        onUndo: async () => {
          setUndone(true)
        },
      })
    }

    render(createElement(Harness))
    fireEvent.click(screen.getByRole("button", { name: "Undo" }))

    expect(
      await screen.findByRole("button", { name: /Undid the previous action/ })
    ).toBeInTheDocument()
    expect(screen.getAllByText("Undone")).toHaveLength(1)
    expect(
      screen.queryByRole("button", { name: "Undo" })
    ).not.toBeInTheDocument()
  })
})

describe("ThreadView reply actions", () => {
  it("copies from the keyboard and announces it", async () => {
    vi.useFakeTimers()
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } })
    render(
      createElement(ThreadView, {
        messages: [coachTurn([{ type: "text", text: "Moved it." }])],
        onRegenerate: () => {},
      })
    )

    const copy = screen.getByRole("button", { name: "Copy" })
    copy.focus()
    expect(copy).toHaveFocus()
    fireEvent.click(copy)

    expect(writeText).toHaveBeenCalledWith("Moved it.")
    expect(
      screen.getByText("Copied", { selector: "[aria-live='polite']" })
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument()
  })

  it("offers Copy and Regenerate and no voice control", () => {
    render(
      createElement(ThreadView, {
        messages: [coachTurn([{ type: "text", text: "Moved it." }])],
        onRegenerate: () => {},
      })
    )

    expect(screen.getByRole("button", { name: "Copy" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Regenerate" })).toBeEnabled()
    expect(
      screen.queryByRole("button", { name: /read aloud|speak|voice/i })
    ).not.toBeInTheDocument()
  })
})
