// @vitest-environment jsdom
import { createElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"

import { PaperSuggestionBar } from "./paper-suggestion-bar.tsx"
import type { PaperSuggestion, SuggestionEntry } from "./paper-suggestion.ts"

afterEach(cleanup)

const suggestion: PaperSuggestion = {
  previous: {},
  sections: ["Summary", "Experience"],
  sectionIds: ["summary", "experience"],
}

function bar(log: SuggestionEntry[] = []) {
  const onKeep = vi.fn()
  const onUndo = vi.fn()
  render(createElement(PaperSuggestionBar, { suggestion, log, onKeep, onUndo }))
  return { onKeep, onUndo }
}

describe("PaperSuggestionBar", () => {
  it("is one Item that names the sections and holds the two decision buttons", () => {
    bar()
    const item = screen.getByRole("status", { name: "Coach suggestion" })
    expect(item).toHaveAttribute("data-slot", "item")
    expect(item).toHaveTextContent("Coach changed Summary and Experience.")
    expect(screen.getByRole("button", { name: "Keep" })).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Undo this change" })
    ).toBeInTheDocument()
  })

  it("calls Undo and Keep from their own buttons", () => {
    const { onKeep, onUndo } = bar()
    fireEvent.click(screen.getByRole("button", { name: "Undo this change" }))
    expect(onUndo).toHaveBeenCalledTimes(1)
    expect(onKeep).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Keep" }))
    expect(onKeep).toHaveBeenCalledTimes(1)
  })

  it("opens a read-only thread of this change and the ones decided before", async () => {
    bar([
      { id: "suggestion-0", sections: ["Skills"], outcome: "undone", at: 1 },
    ])
    fireEvent.click(screen.getByRole("button", { name: "What changed" }))
    expect(await screen.findByText("Changed Skills.")).toBeInTheDocument()
    expect(screen.getByText("Changed Summary, Experience.")).toBeInTheDocument()
    expect(screen.getByText("You undid it")).toBeInTheDocument()
    expect(screen.getByText("Waiting for your decision")).toBeInTheDocument()
    expect(screen.queryByRole("textbox", { name: "Reply" })).toBeNull()
  })
})
