import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { CoachHome } from "./coach-home.tsx"
import { COACH_STARTERS } from "./coach-starters.ts"

const UNTRUE_STARTERS = [
  "Find roles",
  "Companies hiring now",
  "Improve my LinkedIn",
]

function renderHome(disabled = false) {
  const choose = vi.fn()
  render(
    <CoachHome onChooseStarter={choose} disabled={disabled}>
      <div>Composer</div>
    </CoachHome>
  )
  return choose
}

describe("Coach home pane", () => {
  it("leads with a quiet heading, then the composer, then three starter cards", () => {
    renderHome()
    const heading = screen.getByRole("heading", { level: 2 })
    expect(heading).toHaveTextContent("How can I help?")
    expect(heading.className).toContain("text-[20px]")
    expect(heading.className).toContain("font-medium")
    const composer = screen.getByText("Composer")
    const ideas = screen.getByRole("list", { name: "Ideas for Coach" })
    expect(
      composer.compareDocumentPosition(ideas) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(within(ideas).getAllByRole("listitem")).toHaveLength(3)
  })

  it("names each card by its title, describes it, and sends the title", () => {
    const choose = renderHome()
    for (const { title, description } of COACH_STARTERS) {
      const card = screen.getByRole("button", { name: title })
      expect(card).toHaveAccessibleDescription(description)
      fireEvent.click(card)
      expect(choose).toHaveBeenLastCalledWith(title)
    }
  })

  it("offers no starter that needs job search or web tools", () => {
    renderHome()
    for (const name of [...UNTRUE_STARTERS, "More ideas"])
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument()
  })

  it("keeps every card reachable by keyboard with nothing scrolled out of view", () => {
    renderHome()
    const ideas = screen.getByRole("list", { name: "Ideas for Coach" })
    expect(ideas.className).not.toMatch(/overflow-(x-)?(auto|scroll|hidden)/)
    for (const card of within(ideas).getAllByRole("button")) {
      card.focus()
      expect(card).toHaveFocus()
    }
  })

  it("disables choosing a starter while Coach cannot send", () => {
    const choose = renderHome(true)
    const starter = screen.getByRole("button", { name: "Review my CV" })
    expect(starter).toBeDisabled()
    fireEvent.click(starter)
    expect(choose).not.toHaveBeenCalled()
  })
})
