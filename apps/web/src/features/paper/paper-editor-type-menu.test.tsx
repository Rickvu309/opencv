import { act, cleanup, fireEvent, screen } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it } from "vitest"

import { paragraph, seededLetterClient } from "@/test/paper-fixture.ts"
import {
  installEditorPolyfills,
  openEngine,
  selectText,
  settle,
} from "@/test/paper-engine-kit.tsx"

beforeAll(installEditorPolyfills)
afterEach(cleanup)

const toolbar = () => screen.queryByLabelText("Format")

describe("the format toolbar type menu", () => {
  it("keeps the toolbar and the menu open and sets the heading", async () => {
    const client = seededLetterClient([paragraph("p1", "hello world")])
    const { seen } = openEngine(client)
    await selectText(seen.editor!, 3, 8)
    fireEvent.click(await screen.findByText("Text"))
    const item = await screen.findByText("Heading 2")
    await settle()
    expect(toolbar()).toBeInTheDocument()
    expect(screen.getByText("Heading 2")).toBe(item)
    fireEvent.click(item)
    await settle()
    expect(client.document()!.blocks[0]).toMatchObject({
      type: "heading",
      level: 2,
    })
  })

  it("applies the chosen type to every selected block", async () => {
    const client = seededLetterClient([
      paragraph("p1", "one"),
      paragraph("p2", "two"),
      paragraph("p3", "three"),
    ])
    const { seen } = openEngine(client)
    act(() => {
      seen.editor!.focus()
      seen.editor!.setSelection("p1", "p2")
    })
    await settle()
    fireEvent.click(await screen.findByText("Text"))
    fireEvent.click(await screen.findByText("Bulleted list"))
    await settle()
    expect(
      client.document()!.blocks.map((block) => (block as { type: string }).type)
    ).toEqual(["bullet", "bullet", "paragraph"])
  })
})
