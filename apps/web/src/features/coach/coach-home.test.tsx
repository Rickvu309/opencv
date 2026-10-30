import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import newChat from "./design/new-chat.styles.json"
import ideas from "./design/ideas.styles.json"
import { CoachHome } from "./coach-home.tsx"

function paneLabels(source: typeof newChat) {
  return source.sections.flatMap((section) =>
    section.texts.map((text) => text.content)
  )
}

describe("Coach home pane", () => {
  it.each([
    { moreIdeas: false, source: newChat },
    { moreIdeas: true, source: ideas },
  ])(
    "shows the pen's suggestion set with moreIdeas=$moreIdeas",
    ({ moreIdeas, source }) => {
      const choose = vi.fn()
      const toggle = vi.fn()
      render(
        <CoachHome
          moreIdeas={moreIdeas}
          onToggleIdeas={toggle}
          onChooseStarter={choose}
          disabled={false}
        >
          <div>Composer</div>
        </CoachHome>
      )
      expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(
        paneLabels(source)[1]
      )
      const labels = paneLabels(source).slice(5)
      expect(
        screen.getAllByRole("button").map((button) => button.textContent)
      ).toEqual(["More ideas", ...labels])
      for (const label of labels) {
        fireEvent.click(
          screen.getByRole("button", { name: label, exact: true })
        )
        expect(choose).toHaveBeenLastCalledWith(label)
      }
      const more = screen.getByRole("button", { name: "More ideas" })
      expect(more).toHaveAttribute("aria-pressed", String(moreIdeas))
      fireEvent.click(more)
      expect(toggle).toHaveBeenCalledOnce()
    }
  )

  it("keeps ideas browsable while choosing a starter is disabled", () => {
    const choose = vi.fn()
    render(
      <CoachHome
        moreIdeas={false}
        onToggleIdeas={vi.fn()}
        onChooseStarter={choose}
        disabled
      >
        <div>Composer</div>
      </CoachHome>
    )
    const starter = screen.getByRole("button", { name: "Review my CV" })
    expect(starter).toBeDisabled()
    fireEvent.click(starter)
    expect(choose).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "More ideas" })).toBeEnabled()
  })
})
