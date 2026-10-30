import { afterEach, expect, it } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useReducer } from "react"
import type { CvBlock } from "@workspace/domain"

import { ExperienceBlockField } from "./paper-block-entries.tsx"
import { blockFields } from "./paper-block-fields.tsx"

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

function ListEditor({ type }: { type: "bulleted-list" | "numbered-list" }) {
  const [block, setBlock] = useReducer((_: CvBlock, next: CvBlock) => next, {
    id: "list",
    type,
    items: [{ id: "first", text: "Original item" }],
  })
  return blockFields[block.type]({
    block,
    sectionKind: "experience",
    editing: true,
    onChange: setBlock,
    onCommit: setBlock,
    onSlash: () => {},
  })
}

it.each(["bulleted-list", "numbered-list"] satisfies Array<
  "bulleted-list" | "numbered-list"
>)(
  "moves typing into the inserted %s item and preserves surrounding items",
  (type) => {
    render(<ListEditor type={type} />)
    const original = screen.getByRole("textbox", { name: "List item" })
    original.focus()
    fireEvent.keyDown(original, { key: "Enter" })
    const items = screen.getAllByRole("textbox", { name: "List item" })
    expect(items).toHaveLength(2)
    const added = items.find((item) => item !== original)
    expect(added).toBeDefined()
    if (!added) throw new Error("Inserted item is missing")
    expect(document.activeElement).toBe(added)
    added.textContent = "New item"
    fireEvent.input(added)
    expect(original.textContent).toBe("Original item")
    expect(added.textContent).toBe("New item")
    original.focus()
    fireEvent.keyDown(original, { key: "Enter" })
    const inserted = screen.getAllByRole("textbox", { name: "List item" })
    expect(inserted).toHaveLength(3)
    expect(document.activeElement).toBe(inserted[1])
    expect(inserted[0]?.textContent).toBe("Original item")
    expect(inserted[2]?.textContent).toBe("New item")
  }
)
