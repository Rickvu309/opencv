import { act, cleanup, fireEvent, screen } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it } from "vitest"

import { seededLetterClient } from "@/test/paper-fixture.ts"
import {
  installEditorPolyfills,
  openEngine,
  selectText,
  settle,
} from "@/test/paper-engine-kit.tsx"

beforeAll(installEditorPolyfills)
afterEach(cleanup)

const linked = () =>
  ({
    id: "p1",
    type: "paragraph",
    content: [{ text: "site", href: "https://old.example.com" }],
  }) as never

describe("the link bar", () => {
  it("edits the address of an existing link from the link bar", async () => {
    const client = seededLetterClient([
      {
        id: "p1",
        type: "paragraph",
        content: [{ text: "site", href: "https://old.example.com" }],
      } as never,
    ])
    const { seen } = openEngine(client)
    await selectText(seen.editor!, 5, 5)
    fireEvent.click(await screen.findByText("Edit"))
    const input = await screen.findByLabelText("Link address")
    fireEvent.change(input, { target: { value: "new.example.com" } })
    fireEvent.click(screen.getByText("Save"))
    await settle()
    const text = JSON.stringify(client.document())
    expect(text).toContain("https://new.example.com")
    expect(text).not.toContain("old.example.com")
  })

  it("removes a link from the link bar and keeps its words", async () => {
    const client = seededLetterClient([
      {
        id: "p1",
        type: "paragraph",
        content: [{ text: "site", href: "https://old.example.com" }],
      } as never,
    ])
    const { seen } = openEngine(client)
    await selectText(seen.editor!, 5, 5)
    fireEvent.click(await screen.findByText("Remove"))
    await settle()
    const text = JSON.stringify(client.document())
    expect(text).toContain("site")
    expect(text).not.toContain("old.example.com")
  })
  it("saves the edited address on Enter", async () => {
    const client = seededLetterClient([linked()])
    const { seen } = openEngine(client)
    await selectText(seen.editor!, 5, 5)
    fireEvent.click(await screen.findByText("Edit"))
    const input = await screen.findByLabelText("Link address")
    fireEvent.change(input, { target: { value: "new.example.com" } })
    fireEvent.keyDown(input, { key: "Enter" })
    await settle()
    expect(JSON.stringify(client.document())).toContain(
      "https://new.example.com"
    )
  })

  it("puts focus back in the text at the selection on Escape from the edit field", async () => {
    const client = seededLetterClient([linked()])
    const { seen } = openEngine(client)
    await selectText(seen.editor!, 5, 5)
    const { from } = seen.editor!.prosemirrorState.selection
    fireEvent.click(await screen.findByText("Edit"))
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
    expect(seen.editor!.prosemirrorState.selection.from).toBe(from)
    expect(JSON.stringify(client.document())).toContain("old.example.com")
  })
})
