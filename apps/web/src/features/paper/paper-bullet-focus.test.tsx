import { afterEach, expect, it } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useReducer } from "react"
import type { CvBlock } from "@workspace/domain"

import { ExperienceBlockField } from "./paper-block-entries.tsx"

afterEach(cleanup)

function Editor() {
  const [block, setBlock] = useReducer((_: CvBlock, next: CvBlock) => next, {
    id: "experience",
    type: "experience-entry",
    role: "Engineer",
    company: "Example",
    period: "2020",
    bullets: [{ id: "first", text: "Original bullet" }],
  })
  return (
    <ExperienceBlockField
      block={block}
      sectionKind="experience"
      editing
      onChange={setBlock}
      onCommit={setBlock}
      onSlash={() => {}}
    />
  )
}

it("moves typing into the newly inserted bullet and preserves the previous text", () => {
  render(<Editor />)
  const original = screen.getByRole("textbox", { name: "Bullet point" })
  original.focus()
  fireEvent.keyDown(original, { key: "Enter" })
  const added = screen.getByRole("textbox", {
    name: "What you did, and what changed because of it",
  })
  expect(document.activeElement).toBe(added)
  added.textContent = "New bullet"
  fireEvent.input(added)
  expect(original.textContent).toBe("Original bullet")
  expect(added.textContent).toBe("New bullet")
  fireEvent.keyDown(added, { key: "Enter" })
  expect(document.activeElement).toBe(
    screen.getByRole("textbox", {
      name: "What you did, and what changed because of it",
    })
  )
})
