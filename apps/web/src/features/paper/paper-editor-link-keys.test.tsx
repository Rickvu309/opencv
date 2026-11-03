import { act, cleanup, fireEvent, screen } from "@testing-library/react"
import { TextSelection } from "prosemirror-state"
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

describe("the link field from the keyboard", () => {
  it("adds the link when Enter is pressed in the address field", async () => {
    const client = seededLetterClient([paragraph("p1", "hello world")])
    const { seen } = openEngine(client)
    await selectText(seen.editor!, 3, 8)
    fireEvent.click(await screen.findByLabelText("Link"))
    const input = await screen.findByLabelText("Link address")
    fireEvent.change(input, { target: { value: "example.com" } })
    fireEvent.keyDown(input, { key: "Enter" })
    await settle()
    expect(JSON.stringify(client.document())).toContain("https://example.com")
    expect(screen.queryByLabelText("Link address")).toBeNull()
  })

  it("puts focus back in the text at the selection on Escape", async () => {
    const client = seededLetterClient([paragraph("p1", "hello world")])
    const { seen } = openEngine(client)
    await selectText(seen.editor!, 3, 8)
    const { from, to } = seen.editor!.prosemirrorState.selection
    fireEvent.click(await screen.findByLabelText("Link"))
    const input = await screen.findByLabelText("Link address")
    act(() => {
      input.focus()
    })
    fireEvent.keyDown(input, { key: "Escape" })
    await settle()
    expect(screen.queryByLabelText("Link address")).toBeNull()
    expect(
      document.querySelector(".ProseMirror")!.contains(document.activeElement)
    ).toBe(true)
    const after = seen.editor!.prosemirrorState.selection
    expect([after.from, after.to]).toEqual([from, to])
  })
  it("keeps a Cmd+K pressed before the toolbar shows and opens the field once it does", async () => {
    const client = seededLetterClient([paragraph("p1", "hello world")])
    const { seen } = openEngine(client)
    const proseMirror = document.querySelector(".ProseMirror")!
    act(() => {
      seen.editor!.focus()
    })
    fireEvent.pointerDown(proseMirror)
    act(() => {
      seen.editor!.transact((tr) =>
        tr.setSelection(TextSelection.create(tr.doc, 3, 8))
      )
    })
    expect(toolbar()).toBeNull()
    const notPrevented = fireEvent.keyDown(
      document.querySelector(".ProseMirror")!,
      { key: "k", metaKey: true }
    )
    expect(notPrevented).toBe(false)
    expect(screen.queryByLabelText("Link address")).toBeNull()
    fireEvent.pointerUp(proseMirror)
    expect(await screen.findByLabelText("Link address")).toBeInTheDocument()
    expect(toolbar()).toBeInTheDocument()
  })
})
