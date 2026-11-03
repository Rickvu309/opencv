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

describe("the format toolbar link field", () => {
  it("stays open while the link address is typed and adds the link", async () => {
    const client = seededLetterClient([paragraph("p1", "hello world")])
    const { seen } = openEngine(client)
    await selectText(seen.editor!, 3, 8)
    fireEvent.click(await screen.findByLabelText("Link"))
    const input = await screen.findByLabelText("Link address")
    act(() => {
      input.focus()
    })
    await settle()
    expect(toolbar()).toBeInTheDocument()
    expect(screen.getByLabelText("Link address")).toBe(input)
    fireEvent.change(input, { target: { value: "example.com" } })
    fireEvent.click(screen.getByText("Add"))
    await settle()
    expect(JSON.stringify(client.document())).toContain("https://example.com")
  })

  it("opens the link field on Cmd+K over a selection", async () => {
    const client = seededLetterClient([paragraph("p1", "hello world")])
    const { seen } = openEngine(client)
    await selectText(seen.editor!, 3, 8)
    await screen.findByLabelText("Format")
    expect(screen.queryByLabelText("Link address")).toBeNull()
    const proseMirror = document.querySelector(".ProseMirror")!
    const notPrevented = fireEvent.keyDown(proseMirror, {
      key: "k",
      metaKey: true,
    })
    expect(notPrevented).toBe(false)
    expect(await screen.findByLabelText("Link address")).toBeInTheDocument()
    expect(toolbar()).toBeInTheDocument()
  })

  it("leaves Cmd+K alone when nothing is selected", async () => {
    const client = seededLetterClient([paragraph("p1", "hello world")])
    const { seen } = openEngine(client)
    await selectText(seen.editor!, 5, 5)
    const notPrevented = fireEvent.keyDown(
      document.querySelector(".ProseMirror")!,
      { key: "k", ctrlKey: true }
    )
    expect(notPrevented).toBe(true)
    expect(screen.queryByLabelText("Link address")).toBeNull()
  })
})
