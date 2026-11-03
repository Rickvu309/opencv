import { act, cleanup, fireEvent, render } from "@testing-library/react"
import { type PaperClient } from "@workspace/paper-crdt"
import { afterEach, beforeAll, describe, expect, it } from "vitest"

import { paragraph, seededLetterClient } from "@/test/paper-fixture.ts"

import {
  PaperEditorEngine,
  type LetterEditor,
  type PaperEditorHandle,
} from "./paper-editor-engine.tsx"
import { changeBlockType, isNestedListItem } from "./list-block-ops.ts"

beforeAll(() => {
  ;(globalThis as { ClipboardEvent?: unknown }).ClipboardEvent ??=
    class extends Event {
      clipboardData = null
    }
  Element.prototype.getClientRects ??= () => [] as unknown as DOMRectList
  Range.prototype.getClientRects ??= () => [] as unknown as DOMRectList
  Range.prototype.getBoundingClientRect ??= () => new DOMRect()
})

afterEach(cleanup)

function open(client: PaperClient, generation = 1) {
  const seen = {
    editor: null as LetterEditor | null,
    handle: null as PaperEditorHandle | null,
  }
  const element = (turn: number) => (
    <PaperEditorEngine
      kind="letter"
      client={client}
      generation={turn}
      label="Letter"
      onDocument={() => undefined}
      onSelectedBlocks={() => undefined}
      onReady={(editor) => {
        seen.editor = editor
      }}
      handleRef={(handle) => {
        seen.handle = handle
      }}
    />
  )
  const view = render(element(generation))
  return { seen, rerender: (turn: number) => view.rerender(element(turn)) }
}

type Shape = { id: string; type: string; children?: Shape[] }

const bullet = (id: string, text: string, children: unknown[] = []) => ({
  id,
  type: "bullet" as const,
  content: text ? [{ text }] : [],
  children: children as never,
})

const blocksOf = (client: PaperClient) =>
  client.document()!.blocks as unknown as Shape[]

const press = (key: string) =>
  act(() => {
    fireEvent.keyDown(document.querySelector(".ProseMirror")!, { key })
  })

const depthOf = (nodes: Shape[]): number =>
  nodes.length === 0
    ? 0
    : 1 + Math.max(...nodes.map((node) => depthOf(node.children ?? [])))

describe("Backspace at the start of a list item", () => {
  it("outdents a nested list item", () => {
    const client = seededLetterClient([
      bullet("a", "top", [bullet("b", "kid")]),
    ])
    const { seen } = open(client)
    act(() => {
      seen.editor!.setTextCursorPosition("b", "start")
    })
    press("Backspace")
    const blocks = blocksOf(client)
    expect(blocks.map((block) => block.id)).toEqual(["a", "b"])
    expect(blocks.map((block) => block.type)).toEqual(["bullet", "bullet"])
  })

  it("turns a top-level item with children into a paragraph and lifts the children", () => {
    const client = seededLetterClient([
      bullet("a", "top", [bullet("b", "kid", [bullet("c", "grandkid")])]),
    ])
    const { seen } = open(client)
    act(() => {
      seen.editor!.setTextCursorPosition("a", "start")
    })
    press("Backspace")
    const blocks = blocksOf(client)
    expect(blocks.map((block) => [block.id, block.type])).toEqual([
      ["a", "paragraph"],
      ["b", "bullet"],
    ])
    expect(blocks[1]!.children!.map((block) => block.id)).toEqual(["c"])
    expect(JSON.stringify(blocks)).toContain("grandkid")
  })

  it("leaves a childless top-level item to the editor", () => {
    const client = seededLetterClient([bullet("a", "alone")])
    const { seen } = open(client)
    act(() => {
      seen.editor!.setTextCursorPosition("a", "start")
    })
    press("Backspace")
    expect(blocksOf(client).map((block) => block.type)).toEqual(["paragraph"])
  })
})

describe("Enter on an empty list item", () => {
  it("turns an empty top-level item with children into a paragraph and lifts the children", () => {
    const client = seededLetterClient([
      paragraph("p0", "intro"),
      bullet("a", "", [bullet("b", "kid", [bullet("c", "grandkid")])]),
    ])
    const { seen } = open(client)
    act(() => {
      seen.editor!.setTextCursorPosition("a", "start")
    })
    press("Enter")
    const blocks = blocksOf(client)
    expect(blocks.map((block) => [block.id, block.type])).toEqual([
      ["p0", "paragraph"],
      ["a", "paragraph"],
      ["b", "bullet"],
    ])
    expect(JSON.stringify(blocks)).toContain("grandkid")
  })

  it("turns an empty childless top-level item into a paragraph", () => {
    const client = seededLetterClient([bullet("a", "")])
    const { seen } = open(client)
    act(() => {
      seen.editor!.setTextCursorPosition("a", "start")
    })
    press("Enter")
    expect(blocksOf(client).map((block) => block.type)).toEqual(["paragraph"])
  })
})

describe("the format menu on list items", () => {
  it("turns a parent bullet into text or a heading and lifts its children", () => {
    const client = seededLetterClient([
      bullet("a", "top", [bullet("b", "kid")]),
    ])
    const { seen } = open(client)
    act(() => {
      seen.editor!.setTextCursorPosition("a", "end")
    })
    let applied = false
    act(() => {
      applied = changeBlockType(seen.editor as never, {
        type: "heading",
        props: { level: 2 },
      })
    })
    expect(applied).toBe(true)
    expect(blocksOf(client).map((block) => [block.id, block.type])).toEqual([
      ["a", "heading"],
      ["b", "bullet"],
    ])
  })

  it("refuses text on a nested bullet and reports it as nested", () => {
    const client = seededLetterClient([
      bullet("a", "top", [bullet("b", "kid")]),
    ])
    const { seen } = open(client)
    act(() => {
      seen.editor!.setTextCursorPosition("b", "end")
    })
    expect(isNestedListItem(seen.editor as never)).toBe(true)
    let applied = true
    act(() => {
      applied = changeBlockType(seen.editor as never, { type: "paragraph" })
    })
    expect(applied).toBe(false)
    expect(JSON.stringify(blocksOf(client))).toContain("kid")
    expect(blocksOf(client)[0]!.children![0]!.type).toBe("bullet")
  })
})

describe("pasting into a list item", () => {
  it("keeps the words of two paragraphs pasted into a depth-2 bullet", () => {
    const client = seededLetterClient([
      bullet("a", "top", [bullet("b", "kid")]),
    ])
    const { seen } = open(client)
    act(() => {
      seen.editor!.setTextCursorPosition("b", "end")
      seen.editor!.prosemirrorView!.pasteHTML("<p>line one</p><p>line two</p>")
    })
    const text = JSON.stringify(client.document())
    expect(text).toContain("line one")
    expect(text).toContain("line two")
    expect(depthOf(blocksOf(client))).toBeLessThanOrEqual(3)
  })

  it("keeps the words of a two-level list pasted into a depth-3 bullet", () => {
    const client = seededLetterClient([
      bullet("a", "top", [bullet("b", "mid", [bullet("c", "deep")])]),
    ])
    const { seen } = open(client)
    act(() => {
      seen.editor!.setTextCursorPosition("c", "end")
      seen.editor!.prosemirrorView!.pasteHTML(
        "<ul><li>outer words<ul><li>inner words</li></ul></li></ul>"
      )
    })
    const text = JSON.stringify(client.document())
    expect(text).toContain("outer words")
    expect(text).toContain("inner words")
    expect(depthOf(blocksOf(client))).toBeLessThanOrEqual(3)
  })

  it("resets pasted alignment and color to the defaults", () => {
    const client = seededLetterClient([paragraph("p1", "One")])
    const { seen } = open(client)
    const html = seen.editor!.blocksToFullHTML([
      {
        type: "paragraph",
        props: { textAlignment: "right", textColor: "blue" },
        content: "first words",
      },
      {
        type: "paragraph",
        props: { textAlignment: "right", textColor: "blue" },
        content: "styled words",
      },
    ] as never)
    expect(html).toContain('data-text-alignment="right"')
    act(() => {
      seen.editor!.setTextCursorPosition("p1", "end")
      seen.editor!.prosemirrorView!.pasteHTML(html)
    })
    const pasted = seen.editor!.document.find((block) =>
      JSON.stringify(block.content).includes("styled words")
    )!
    expect(pasted.props).toMatchObject({
      textAlignment: "left",
      textColor: "default",
    })
  })
})

describe("the keyword anchor", () => {
  const short = () =>
    seededLetterClient([
      paragraph("p1", "Dear Linh"),
      paragraph("p2", "I like ads."),
      paragraph("p3", "I like growth."),
      paragraph("p4", "Thanks,"),
      paragraph("p5", "Linh"),
    ])

  it("lands before the closing and signature in a letter of short paragraphs", () => {
    const client = short()
    const { seen } = open(client)
    act(() => {
      seen.handle!.insertText("Meta Ads")
    })
    const blocks = blocksOf(client)
    expect(
      blocks.map((block) => block.id).filter((id) => id.startsWith("p"))
    ).toEqual(["p1", "p2", "p3", "p4", "p5"])
    expect(JSON.stringify(blocks[3])).toContain("Meta Ads")
    expect(blocks.at(-1)!.id).toBe("p5")
  })

  it("forgets the old cursor when the editor remounts", () => {
    const client = short()
    const { seen, rerender } = open(client)
    act(() => {
      seen.editor!.setTextCursorPosition("p1", "end")
    })
    rerender(2)
    act(() => {
      seen.handle!.insertText("Meta Ads")
    })
    const blocks = blocksOf(client)
    expect(blocks).toHaveLength(6)
    expect(JSON.stringify(blocks[0])).not.toContain("Meta Ads")
    expect(JSON.stringify(blocks[3])).toContain("Meta Ads")
  })
})
