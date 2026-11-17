import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type { ChatSummary } from "@workspace/domain"

import { CoachHome } from "./coach-home.tsx"
import { COACH_STARTERS } from "./coach-starters.ts"

const UNTRUE_STARTERS = [
  "Find roles",
  "Companies hiring now",
  "Improve my LinkedIn",
]

function renderHome(disabled = false, size?: "page" | "panel") {
  const choose = vi.fn()
  render(
    <CoachHome onChooseStarter={choose} disabled={disabled} size={size}>
      {size === "panel" ? null : <div>Composer</div>}
    </CoachHome>
  )
  return choose
}

describe("Coach home pane", () => {
  it("names the empty page for screen readers only, then shows the composer and three quiet starter chips", () => {
    renderHome()
    const heading = screen.getByRole("heading", { level: 2 })
    expect(heading).toHaveTextContent("How can I help?")
    expect(heading.className).toContain("sr-only")
    const composer = screen.getByText("Composer")
    expect(composer.parentElement?.className).toContain("max-w-[680px]")
    const ideas = screen.getByRole("list", { name: "Ideas for Coach" })
    expect(
      composer.compareDocumentPosition(ideas) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(within(ideas).getAllByRole("listitem")).toHaveLength(3)
    expect(ideas.className).toContain("flex-wrap")
    expect(ideas.className).toContain("justify-center")
  })

  it("draws each starter as a plain pill with a label, not a card with a description", () => {
    renderHome()
    for (const { title, description } of COACH_STARTERS) {
      const chip = screen.getByRole("button", { name: title })
      expect(chip.className).toContain("rounded-full")
      expect(chip.className).toContain("h-11")
      expect(chip.className).toContain("md:h-9")
      expect(chip.className).toContain("text-muted-foreground")
      expect(chip.className).not.toMatch(/min-h-\[124px\]|bg-card/)
      const shown = [...chip.querySelectorAll("span:not(.sr-only)")]
      expect(shown.map((node) => node.textContent)).toEqual([title])
      expect(chip).toHaveAccessibleDescription(description)
    }
  })

  it("names each chip by its title and sends the title", () => {
    const choose = renderHome()
    for (const { title } of COACH_STARTERS) {
      fireEvent.click(screen.getByRole("button", { name: title }))
      expect(choose).toHaveBeenLastCalledWith(title)
    }
  })

  it("offers no starter that needs job search or web tools", () => {
    renderHome()
    for (const name of UNTRUE_STARTERS)
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument()
  })

  it("keeps every chip reachable by keyboard with nothing scrolled out of view", () => {
    renderHome()
    const ideas = screen.getByRole("list", { name: "Ideas for Coach" })
    expect(ideas.className).not.toMatch(/overflow-(x-)?(auto|scroll|hidden)/)
    for (const chip of within(ideas).getAllByRole("button")) {
      chip.focus()
      expect(chip).toHaveFocus()
    }
  })

  it("disables choosing a starter while Coach cannot send", () => {
    const choose = renderHome(true)
    const starter = screen.getByRole("button", {
      name: COACH_STARTERS[0].title,
    })
    expect(starter).toBeDisabled()
    fireEvent.click(starter)
    expect(choose).not.toHaveBeenCalled()
  })

  it("shows the same heading and chips at panel size, centred in the panel with the composer left at its bottom", () => {
    const choose = renderHome(false, "panel")
    const home = screen.getByRole("heading", { level: 2 }).parentElement
    expect(home).toHaveAttribute("data-size", "panel")
    expect(home?.className).toContain("my-auto")
    expect(screen.getByRole("heading", { level: 2 }).className).toContain(
      "text-[20px]"
    )
    expect(screen.queryByText("Composer")).not.toBeInTheDocument()
    const ideas = screen.getByRole("list", { name: "Ideas for Coach" })
    expect(within(ideas).getAllByRole("button")).toHaveLength(3)
    fireEvent.click(screen.getByRole("button", { name: "Prep an interview" }))
    expect(choose).toHaveBeenLastCalledWith("Prep an interview")
  })

  it("lists recent Chats under the composer instead of starters, newest first with a short age", () => {
    const now = Date.now()
    const chats: ChatSummary[] = Array.from({ length: 10 }, (_, index) => ({
      id: `chat-${index}`,
      title: `Chat ${index}`,
      createdAt: new Date(now - (index + 1) * 86400000).toISOString(),
      updatedAt: new Date(now - (index + 1) * 86400000).toISOString(),
      focusDocId: null,
    }))
    const open = vi.fn()
    render(
      <CoachHome
        onChooseStarter={vi.fn()}
        disabled={false}
        recentChats={chats}
        onOpenChat={open}
      >
        <div>Composer</div>
      </CoachHome>
    )
    expect(
      screen.queryByRole("list", { name: "Ideas for Coach" })
    ).not.toBeInTheDocument()
    const recent = screen.getByRole("list", { name: "Recent chats" })
    expect(
      screen.getByText("Composer").compareDocumentPosition(recent) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    const rows = within(recent).getAllByRole("button")
    expect(rows).toHaveLength(8)
    expect(rows[0]).toHaveAccessibleName("Chat 0, 1 day ago")
    expect(within(rows[0]).getByText("1d")).toHaveAttribute(
      "aria-hidden",
      "true"
    )
    expect(rows[7]).toHaveAccessibleName("Chat 7, 1 week ago")
    fireEvent.click(rows[2])
    expect(open).toHaveBeenCalledWith("chat-2")
  })

  it("keeps the starters in the panel even when Chats exist", () => {
    render(
      <CoachHome
        size="panel"
        onChooseStarter={vi.fn()}
        disabled={false}
        recentChats={[
          {
            id: "chat-1",
            title: "Old chat",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            focusDocId: null,
          },
        ]}
        onOpenChat={vi.fn()}
      />
    )
    expect(
      screen.queryByRole("list", { name: "Recent chats" })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("list", { name: "Ideas for Coach" })
    ).toBeInTheDocument()
  })
})
