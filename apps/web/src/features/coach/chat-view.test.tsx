import { createElement, useReducer } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"

import { STREAMING_COACH_ID } from "@/features/coach/chat-messages.ts"
import { ChatView } from "@/features/coach/chat-view.tsx"

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
  name: "job.move",
  summary: "Moved 'Backend Intern' to Prep",
  ok: true,
  toolCallId: "call-1",
  activityId: "activity-1",
  reversal: {
    possible: true,
    description: "Undo by moving the card back.",
    command: "job.move",
    input: { cardId: "c1", stage: "inbox" },
  },
}

const createReceipt = {
  type: "tool" as const,
  name: "paper.create",
  summary: "Created CV Untitled CV",
  ok: true,
  toolCallId: "call-2",
}

function coachTurn(
  parts: Parameters<typeof ChatView>[0]["messages"][0]["parts"]
) {
  return {
    id: "coach-1",
    role: "coach" as const,
    text: "Moved it.",
    parts,
  }
}

describe("ChatView thinking state", () => {
  it("shows one Thinking loader and no second shimmer while waiting", () => {
    render(createElement(ChatView, { messages: [], waiting: true }))

    const chat = screen.getByRole("log", { name: "Chat" })
    expect(within(chat).getByRole("status")).toHaveTextContent(/^Working$/)
    expect(screen.queryByText("Thinking…")).not.toBeInTheDocument()
  })

  it("drops the loader once reply text is on screen and keeps no running timer", () => {
    render(
      createElement(ChatView, {
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
      createElement(ChatView, {
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

describe("ChatView steps", () => {
  it("folds two adjacent steps into one group and keeps Undo reachable", () => {
    render(
      createElement(ChatView, {
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
      createElement(ChatView, {
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
      const [undone, markUndone] = useReducer(() => true, false)
      const parts = undone
        ? [
            { type: "text" as const, text: "Moved it." },
            { ...moveReceipt, undone: true },
            {
              type: "tool" as const,
              name: "job.move",
              summary: "Undid the previous action",
              ok: true,
              toolCallId: "call-undo",
            },
          ]
        : [{ type: "text" as const, text: "Moved it." }, moveReceipt]
      return createElement(ChatView, {
        messages: [coachTurn(parts)],
        onUndo: async () => {
          markUndone()
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

describe("ChatView reply actions", () => {
  it("copies from the keyboard and announces it", async () => {
    vi.useFakeTimers()
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } })
    render(
      createElement(ChatView, {
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
      createElement(ChatView, {
        messages: [coachTurn([{ type: "text", text: "Moved it." }])],
        onRegenerate: () => {},
      })
    )

    expect(screen.getByRole("button", { name: "Copy" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Regenerate" })).toBeEnabled()
    expect(
      screen.queryByRole("button", { name: /read aloud|speak|voice/i })
    ).not.toBeInTheDocument()
    const copy = screen.getByRole("button", { name: "Copy" })
    expect(copy.className).toMatch(/focus-visible:ring/)
    expect(copy.className).toMatch(/\bsize-4\b/)
    expect(copy.className).toMatch(/before:size-9/)
    expect(copy.className).toMatch(/pointer:coarse\)\]:before:size-11/)
    expect(copy.className).toMatch(/motion-reduce:transition-none/)
  })

  it("keeps Copy and Regenerate shown at rest, on hover and on keyboard focus, and never hides them from assistive tech", () => {
    render(
      createElement(ChatView, {
        messages: [coachTurn([{ type: "text", text: "Moved it." }])],
        onRegenerate: () => {},
      })
    )
    const actions = screen.getByRole("group", { name: "Reply actions" })
    const copy = within(actions).getByRole("button", { name: "Copy" })
    const regenerate = within(actions).getByRole("button", {
      name: "Regenerate",
    })
    const hiding = /(?<![\w:-])(opacity-0|invisible|sr-only|hidden)(?![\w-])/
    for (
      let node: HTMLElement | null = actions;
      node && node !== document.body;
      node = node.parentElement
    ) {
      expect(node).not.toHaveAttribute("aria-hidden", "true")
      expect(node).not.toHaveAttribute("inert")
      expect(node.className).not.toMatch(hiding)
    }
    for (const button of [copy, regenerate]) {
      expect(button.className).not.toMatch(hiding)
      expect(button).toBeVisible()
    }
    fireEvent.mouseEnter(actions)
    expect(copy).toBeVisible()
    fireEvent.mouseLeave(actions)
    expect(copy).toBeVisible()
    copy.focus()
    expect(copy).toHaveFocus()
    expect(copy).toBeVisible()
    regenerate.focus()
    expect(regenerate).toHaveFocus()
    expect(regenerate).toBeVisible()
  })

  it("keeps the latest reply's actions shown and lets older replies show theirs on hover or focus, always on touch", () => {
    render(
      createElement(ChatView, {
        messages: [
          {
            ...coachTurn([{ type: "text", text: "First." }]),
            id: "coach-0",
            text: "First.",
          },
          { id: "user-1", role: "user" as const, text: "And then?" },
          coachTurn([{ type: "text", text: "Moved it." }]),
        ],
        onRegenerate: () => {},
      })
    )
    const [older, latest] = screen.getAllByRole("group", {
      name: "Reply actions",
    })
    const olderFooter = older.closest("[data-reveal]")
    const latestFooter = latest.closest("[data-reveal]")
    expect(latestFooter).toHaveAttribute("data-reveal", "always")
    expect(latestFooter?.className).not.toMatch(/opacity-0/)
    expect(olderFooter).toHaveAttribute("data-reveal", "on-hover")
    expect(olderFooter?.className).toMatch(/(^|\s)pointer-fine:opacity-0(\s|$)/)
    expect(olderFooter?.className).toMatch(
      /pointer-fine:group-hover\/reply:opacity-100/
    )
    expect(olderFooter?.className).toMatch(
      /pointer-fine:focus-within:opacity-100/
    )
    expect(olderFooter?.className).not.toMatch(/(^|\s)opacity-0(\s|$)/)
    expect(older).not.toHaveAttribute("aria-hidden")
    const olderCopy = within(older).getByRole("button", { name: "Copy" })
    olderCopy.focus()
    expect(olderCopy).toHaveFocus()
  })

  it("never hides a receipt's Undo on an older reply behind hover", () => {
    render(
      createElement(ChatView, {
        messages: [
          coachTurn([moveReceipt, { type: "text", text: "Moved it." }]),
          { id: "user-2", role: "user" as const, text: "Thanks" },
          {
            ...coachTurn([{ type: "text", text: "Anytime." }]),
            id: "coach-2",
            text: "Anytime.",
          },
        ],
        onRegenerate: () => {},
        onUndo: async () => {},
      })
    )
    const undo = screen.getByRole("button", { name: /undo/i })
    expect(undo).toBeVisible()
    expect(undo.closest("[data-reveal]")).toBeNull()
    for (
      let node: HTMLElement | null = undo;
      node && node !== document.body;
      node = node.parentElement
    ) {
      const hiding = node.className
        .split(/\s+/)
        .filter((name) => /^(pointer-fine:)?(opacity-0|invisible)$/.test(name))
      expect(hiding).toEqual([])
      expect(node).not.toHaveAttribute("aria-hidden", "true")
    }
  })

  it("hides Copy and Regenerate on an empty or failed reply and offers Retry on the alert", () => {
    const onRetry = vi.fn()
    render(
      createElement(ChatView, {
        messages: [
          {
            id: "coach-empty",
            role: "coach",
            text: "",
            workedMs: 2000,
            status: "error",
          },
        ],
        error: "The Coach stopped. Try again.",
        onRetry,
        onRegenerate: () => {},
      })
    )

    expect(
      screen.queryByRole("button", { name: "Copy" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Regenerate" })
    ).not.toBeInTheDocument()
    const alert = screen.getByRole("alert")
    expect(alert).toHaveAttribute("data-slot", "alert")
    expect(alert).toHaveTextContent("The Coach stopped. Try again.")
    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})

describe("ChatView pending message", () => {
  it("shows the sent message in the first render while Coach is still working", () => {
    render(
      createElement(ChatView, {
        messages: [],
        waiting: true,
        pendingUser: {
          id: "pending-user",
          role: "user",
          text: "Tighten my summary",
        },
        seenUserCount: 0,
      })
    )

    expect(screen.getByText("Tighten my summary")).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent(/^Working$/)
    const log = screen.getByRole("log", { name: "Chat" })
    expect(log.className).toContain("max-w-[760px]")
    expect(log.className).not.toContain("max-w-[680px]")
    expect(log.className).toContain("gap-8")
    expect(log.className).toContain(
      "[&_[data-slot=message-content]]:text-[15px]"
    )
    expect(log.className).toContain(
      "[&_[data-slot=message-content]]:leading-[1.5]"
    )
    expect(log.className).toContain(
      "[&_[data-slot=message-content]]:max-w-[75ch]"
    )
    expect(log.className).toContain("pt-6")
  })

  it("keeps the compact log on the panel gap", () => {
    render(
      createElement(ChatView, {
        presentation: "compact",
        messages: [],
        waiting: true,
        pendingUser: {
          id: "pending-user",
          role: "user",
          text: "Tighten my summary",
        },
        seenUserCount: 0,
      })
    )
    const log = screen.getByRole("log", { name: "Chat" })
    expect(log.className).toContain("gap-3.5")
    expect(log.className).not.toContain("gap-8")
    expect(log.className).not.toContain("pt-6")
  })

  it("does not paint the pending message twice once the store has it", () => {
    render(
      createElement(ChatView, {
        messages: [{ id: "user-1", role: "user", text: "Hello" }],
        pendingUser: { id: "pending-user", role: "user", text: "Hello" },
        seenUserCount: 0,
      })
    )

    expect(screen.getAllByText("Hello")).toHaveLength(1)
  })
})
