import { act, cleanup, screen } from "@testing-library/react"
import { writeDocument, type PaperClient } from "@workspace/paper-crdt"
import { NodeSelection, TextSelection } from "prosemirror-state"
import { afterEach, beforeAll, describe, expect, it } from "vitest"

import { paragraph, seededLetterClient } from "@/test/paper-fixture.ts"
import { installEditorPolyfills, openEngine } from "@/test/paper-engine-kit.tsx"

beforeAll(installEditorPolyfills)
afterEach(cleanup)

type Shape = { id: string; content?: unknown }

function rewriteBlock(client: PaperClient, id: string, text: string) {
  const doc = client.document()!
  writeDocument(
    client.ydoc,
    {
      ...doc,
      blocks: doc.blocks.map((block) =>
        block.id === id ? { ...block, content: [{ text }] } : block
      ),
    } as never,
    "coach-remote"
  )
}

const letter = () =>
  seededLetterClient([
    paragraph("p1", "Hi"),
    paragraph("p2", "Second words here"),
    paragraph("p3", "Warm regards,"),
    paragraph("p4", "Linh"),
  ])

describe("Add to letter after a remote edit", () => {
  it("inserts at the cursor's mapped place and not at the old raw position", () => {
    const client = letter()
    const { seen } = openEngine(client)
    act(() => {
      seen.editor!.setTextCursorPosition("p2", "end")
    })
    act(() => {
      rewriteBlock(
        client,
        "p1",
        "Hi there, the Coach added a long opening sentence here."
      )
    })
    act(() => {
      seen.handle!.insertText("[KW]")
    })
    const blocks = client.document()!.blocks as unknown as Shape[]
    const text = (id: string) =>
      JSON.stringify(blocks.find((block) => block.id === id)!.content)
    expect(text("p1")).not.toContain("[KW]")
    expect(text("p2")).toContain("Second words here [KW]")
  })

  it("inserts after the word the caret is in and pads it with spaces", () => {
    const client = letter()
    const { seen } = openEngine(client)
    act(() => {
      seen.editor!.setTextCursorPosition("p2", "start")
      seen.editor!.transact((tr) =>
        tr.setSelection(TextSelection.create(tr.doc, tr.selection.from + 9))
      )
    })
    act(() => {
      seen.handle!.insertText("Meta Ads")
    })
    const blocks = client.document()!.blocks as unknown as Shape[]
    expect(
      JSON.stringify(blocks.find((block) => block.id === "p2")!.content)
    ).toContain("Second words Meta Ads here")
  })

  it("falls back to the gap before the closing when the selection is not in text", () => {
    const client = seededLetterClient([
      paragraph("p1", "Hi"),
      { id: "d1", type: "divider" },
      paragraph("p2", "Second words here"),
      paragraph("p3", "Warm regards,"),
      paragraph("p4", "Linh"),
    ])
    const { seen } = openEngine(client)
    act(() => {
      seen.editor!.setTextCursorPosition("p1", "end")
    })
    act(() => {
      seen.editor!.transact((tr) => {
        let at = -1
        tr.doc.descendants((node, pos) => {
          if (node.type.name === "divider") at = pos
        })
        tr.setSelection(NodeSelection.create(tr.doc, at))
      })
    })
    act(() => {
      seen.handle!.insertText("[KW]")
    })
    const blocks = client.document()!.blocks as unknown as Shape[]
    const holder = blocks.find((block) =>
      JSON.stringify(block.content ?? "").includes("[KW]")
    )
    expect(holder).toBeDefined()
    expect(holder!.id).not.toBe("d1")
    expect(blocks.at(-1)!.id).toBe("p4")
  })
})

describe("the editor after the client resets", () => {
  it("remounts a fresh editor that shows the text it was given", () => {
    const client = letter()
    const { seen, rerender } = openEngine(client)
    const before = seen.editor
    act(() => {
      rewriteBlock(client, "p1", "Rebuilt opening")
    })
    rerender(2)
    expect(seen.editor).not.toBe(before)
    expect(screen.getByText("Rebuilt opening")).toBeInTheDocument()
    expect(screen.getByText("Second words here")).toBeInTheDocument()
  })

  it("puts focus and the caret back where they were when the old editor had focus", () => {
    const client = letter()
    const { seen, rerender } = openEngine(client)
    act(() => {
      seen.editor!.focus()
    })
    act(() => {
      seen.editor!.setTextCursorPosition("p2", "start")
      seen.editor!.transact((tr) =>
        tr.setSelection(TextSelection.create(tr.doc, tr.selection.from + 7))
      )
    })
    rerender(2)
    const { selection } = seen.editor!.prosemirrorState
    expect(seen.editor!.getTextCursorPosition().block.id).toBe("p2")
    expect(selection.$from.parentOffset).toBe(7)
    expect(document.activeElement?.closest(".ProseMirror")).not.toBeNull()
  })

  it("leaves focus alone when the old editor did not have it", () => {
    const client = letter()
    const { seen, rerender } = openEngine(client)
    act(() => {
      seen.editor!.setTextCursorPosition("p2", "end")
    })
    rerender(2)
    expect(document.activeElement?.closest(".ProseMirror") ?? null).toBeNull()
  })
})
