import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { BlockNoteEditor } from "@blocknote/core"
import { blocksToYXmlFragment } from "@blocknote/core/yjs"
import {
  FRAGMENT,
  REBASE_ORIGIN,
  SERVER_ORIGIN,
  letterSchema,
  openPaperClient,
  seedYDoc,
  writeDocument,
  type PaperClient,
} from "@workspace/paper-crdt"
import { afterEach, beforeAll, describe, expect, it } from "vitest"
import * as Y from "yjs"

import { nativePaperDocumentSchema, nativeProvenance } from "@workspace/domain"

import { withSelectedBlocks, setPaperSelection } from "@/lib/paper-selection.ts"
import { paragraph, seededLetterClient } from "@/test/paper-fixture.ts"

import {
  PaperEditorEngine,
  type LetterEditor,
  type PaperEditorHandle,
} from "./paper-editor-engine.tsx"

beforeAll(() => {
  ;(globalThis as { ClipboardEvent?: unknown }).ClipboardEvent ??=
    class extends Event {
      clipboardData = null
    }
  Element.prototype.getClientRects ??= () => [] as unknown as DOMRectList
  Range.prototype.getClientRects ??= () => [] as unknown as DOMRectList
  Range.prototype.getBoundingClientRect ??= () => new DOMRect()
})

afterEach(() => {
  cleanup()
  setPaperSelection("doc", [])
})

function open(client: PaperClient, selected: string[][] = []) {
  const seen = {
    editor: null as LetterEditor | null,
    handle: null as PaperEditorHandle | null,
  }
  const view = render(
    <PaperEditorEngine
      kind="letter"
      client={client}
      generation={1}
      label="Letter"
      onDocument={() => undefined}
      onSelectedBlocks={(ids) => selected.push(ids)}
      onReady={(editor) => {
        seen.editor = editor
      }}
      handleRef={(handle) => {
        seen.handle = handle
      }}
    />
  )
  return { seen, view }
}

const bullet = (id: string, text: string, children: unknown[] = []) => ({
  id,
  type: "bulletListItem",
  props: {},
  content: [{ type: "text", text, styles: {} }],
  children,
})

describe("the letter editor", () => {
  it("underlines a native Unicode selection with the keyboard and supports Undo and Redo", () => {
    const source = nativePaperDocumentSchema.parse({
      version: 4,
      schemaRevision: 1,
      kind: "letter",
      blocks: [paragraph("p1", "Việt é 😀"), paragraph("p2", "Dear team")],
      clashes: [],
    })
    const provenance = nativeProvenance(source)
    const client = openPaperClient(
      {
        epoch: 2,
        revision: 2,
        server: seedYDoc(source),
        pending: Y.encodeStateAsUpdate(new Y.Doc()),
        provenance,
      },
      { provenance }
    )
    const { seen } = open(client)
    act(() => {
      seen.editor!.setSelection("p1", "p2")
      fireEvent.keyDown(document.querySelector(".bn-editor")!, {
        key: "u",
        ctrlKey: true,
      })
    })
    expect(JSON.stringify(client.document())).toContain('"underline":true')
    expect(document.querySelector(".bn-editor u")).toHaveTextContent(
      "Việt é 😀"
    )
    act(() => {
      fireEvent.keyDown(document.querySelector(".bn-editor")!, {
        key: "z",
        ctrlKey: true,
      })
    })
    expect(JSON.stringify(client.document())).not.toContain('"underline":true')
    act(() => {
      fireEvent.keyDown(document.querySelector(".bn-editor")!, {
        key: "z",
        ctrlKey: true,
        shiftKey: true,
      })
    })
    expect(JSON.stringify(client.document())).toContain('"underline":true')
    expect(JSON.stringify(client.document())).toContain("Việt é 😀")
  })

  it("keeps the legacy Letter schema unchanged when underline is requested", () => {
    const client = seededLetterClient([paragraph("p1", "Legacy")])
    const { seen } = open(client)
    act(() => {
      seen.editor!.setTextCursorPosition("p1", "end")
      fireEvent.keyDown(document.querySelector(".bn-editor")!, {
        key: "u",
        ctrlKey: true,
      })
    })
    expect(client.document()?.version).toBe(3)
    expect(JSON.stringify(client.document())).not.toContain("underline")
    expect(client.hasPending()).toBe(false)
  })

  it("shows the stored letter and writes typing into the shared document", async () => {
    const client = seededLetterClient([paragraph("p1", "Dear team")])
    const { seen } = open(client)
    expect(await screen.findByText("Dear team")).toBeInTheDocument()
    act(() => {
      seen.editor!.insertBlocks(
        [{ type: "paragraph", content: "More" }],
        seen.editor!.document[0]!,
        "after"
      )
    })
    expect(client.hasPending()).toBe(true)
    expect(JSON.stringify(client.document())).toContain("More")
  })

  it("splits and joins blocks like a document", () => {
    const client = seededLetterClient([paragraph("p1", "Dear team")])
    const { seen } = open(client)
    const editor = seen.editor!
    act(() => {
      editor.setTextCursorPosition("p1", "end")
      editor.insertBlocks(
        [{ type: "paragraph", content: "Next" }],
        "p1",
        "after"
      )
    })
    expect(client.document()!.blocks).toHaveLength(2)
    act(() => {
      editor.removeBlocks(["p1"])
    })
    expect(client.document()!.blocks).toHaveLength(1)
  })

  it("nests a list item at most three deep", () => {
    const client = seededLetterClient([paragraph("p0", "Intro")])
    const { seen } = open(client)
    const editor = seen.editor!
    act(() => {
      editor.insertBlocks(
        [
          bullet("a", "one"),
          bullet("b", "two"),
          bullet("c", "three"),
          bullet("d", "four"),
        ] as never,
        "p0",
        "after"
      )
    })
    for (const id of ["b", "c", "d"]) {
      act(() => {
        editor.setTextCursorPosition(id, "end")
        editor.nestBlock()
      })
    }
    const depth = (nodes: { id: string; children?: unknown[] }[]): number =>
      nodes.length === 0
        ? 0
        : 1 + Math.max(...nodes.map((n) => depth((n.children ?? []) as never)))
    const doc = client.document()!
    expect(
      depth(doc.blocks as unknown as { id: string; children?: unknown[] }[])
    ).toBeLessThanOrEqual(3)
  })

  it("does not nest a paragraph under another block", () => {
    const client = seededLetterClient([
      paragraph("p1", "One"),
      paragraph("p2", "Two"),
    ])
    const { seen } = open(client)
    act(() => {
      seen.editor!.setTextCursorPosition("p2", "end")
      seen.editor!.nestBlock()
    })
    expect(client.document()!.blocks).toHaveLength(2)
  })

  it("makes selected text bold and keeps the mark in the document", () => {
    const client = seededLetterClient([
      paragraph("p1", "Dear team"),
      paragraph("p2", "Thanks"),
    ])
    const { seen } = open(client)
    act(() => {
      seen.editor!.setSelection("p1", "p2")
      seen.editor!.toggleStyles({ bold: true })
    })
    expect(JSON.stringify(client.document())).toContain('"bold":true')
  })

  it("inserts a keyword at the end when the editor has no cursor", () => {
    const client = seededLetterClient([paragraph("p1", "Dear team")])
    const { seen } = open(client)
    act(() => {
      seen.handle!.insertText("Meta Ads")
    })
    const blocks = client.document()!.blocks
    expect(JSON.stringify(blocks.at(-1))).toContain("Meta Ads")
  })

  it("reports the selected block ids for the Coach", () => {
    const client = seededLetterClient([
      paragraph("p1", "One"),
      paragraph("p2", "Two"),
    ])
    const selected: string[][] = []
    const { seen } = open(client, selected)
    act(() => {
      seen.editor!.setSelection("p1", "p2")
    })
    setPaperSelection("doc", selected.at(-1) ?? [])
    expect(withSelectedBlocks([{ kind: "job", id: "j" }])).toEqual([
      { kind: "job", id: "j" },
      { kind: "paper", id: "doc", blockIds: ["p1", "p2"] },
    ])
  })

  it("keeps the view equal to the document when a reply holds a four-deep list", async () => {
    const client = seededLetterClient([paragraph("p1", "One")])
    const { seen } = open(client)
    const remote = new Y.Doc()
    Y.applyUpdate(remote, Y.encodeStateAsUpdate(client.ydoc))
    const scratch = BlockNoteEditor.create({ schema: letterSchema })
    const before = Y.encodeStateVector(remote)
    remote.transact(() => {
      remote
        .getXmlFragment(FRAGMENT)
        .delete(0, remote.getXmlFragment(FRAGMENT).length)
      blocksToYXmlFragment(
        scratch,
        [
          bullet("w", "w1", [
            bullet("x", "x2", [bullet("y", "y3", [bullet("z", "z4")])]),
          ]),
        ] as never,
        remote.getXmlFragment(FRAGMENT)
      )
    })
    const update = Y.encodeStateAsUpdate(remote, before)
    act(() => {
      client.receive(client.prepare({ pullOnly: true }), {
        epoch: 1,
        revision: 2,
        reset: false,
        stale: false,
        update,
        stateVector: new Uint8Array(),
      })
    })
    expect(await screen.findByText("z4")).toBeInTheDocument()
    const deepest = (blocks: { children: unknown[] }[]): number =>
      blocks.length === 0
        ? 0
        : 1 + Math.max(...blocks.map((b) => deepest(b.children as never)))
    expect(deepest(seen.editor!.document as never)).toBe(4)
  })

  it.each([
    [
      "h1 and h4",
      "<h1>Big title</h1><h4>Small title</h4>",
      ["Big title", "Small title"],
    ],
    ["a quote", "<blockquote>quoted words</blockquote>", ["quoted words"]],
    [
      "mixed content",
      "<p>plain one</p><h1>Heading words</h1><blockquote>quote words</blockquote><table><tr><td>cell words</td></tr></table>",
      ["plain one", "Heading words", "quote words"],
    ],
    [
      "a list four deep",
      "<ul><li>l1<ul><li>l2<ul><li>l3<ul><li>l4</li></ul></li></ul></li></ul></li></ul>",
      ["l1", "l2", "l3", "l4"],
    ],
  ])("keeps the words of a real paste of %s", (_name, html, words) => {
    const client = seededLetterClient([paragraph("p1", "One")])
    const { seen } = open(client)
    act(() => {
      seen.editor!.setTextCursorPosition("p1", "end")
      seen.editor!.prosemirrorView!.pasteHTML(html)
    })
    const text = JSON.stringify(client.document())
    for (const word of words) expect(text).toContain(word)
  })

  it("outdents an empty nested list item on Enter and leaves the list at the top", () => {
    const client = seededLetterClient([
      {
        id: "a",
        type: "bullet",
        content: [{ text: "top" }],
        children: [{ id: "b", type: "bullet", content: [], children: [] }],
      },
    ])
    const { seen } = open(client)
    const press = () =>
      act(() => {
        fireEvent.keyDown(document.querySelector(".bn-editor")!, {
          key: "Enter",
        })
      })
    act(() => {
      seen.editor!.setTextCursorPosition("b", "end")
    })
    press()
    const blocks = client.document()!.blocks as unknown as {
      id: string
      type: string
      children?: unknown[]
    }[]
    expect(blocks.map((block) => block.id)).toEqual(["a", "b"])
    press()
    expect(
      (client.document()!.blocks as unknown as { type: string }[]).map(
        (block) => block.type
      )
    ).toEqual(["bullet", "paragraph"])
  })

  it("sends block ids only for a real selection", () => {
    const client = seededLetterClient([
      paragraph("p1", "One two"),
      paragraph("p2", "Three"),
    ])
    const selected: string[][] = []
    const { seen } = open(client, selected)
    act(() => {
      seen.editor!.setTextCursorPosition("p1", "end")
    })
    expect(selected.at(-1)).toEqual([])
    act(() => {
      seen.editor!.setSelection("p1", "p2")
    })
    expect(selected.at(-1)).toEqual(["p1", "p2"])
  })

  it("puts the keyword at the last cursor and not after the signature", () => {
    const client = seededLetterClient([
      paragraph("p1", "A".repeat(130)),
      paragraph("p2", "Sincerely,"),
      paragraph("p3", "Linh"),
    ])
    const { seen } = open(client)
    act(() => {
      seen.handle!.insertText("Meta Ads")
    })
    const ids = (client.document()!.blocks as unknown as { id: string }[]).map(
      (block) => block.id
    )
    expect(ids.at(-1)).toBe("p3")
    expect(ids.slice(0, 2)).toEqual(["p1", ids[1]])
    expect(ids[1]).not.toBe("p2")
    act(() => {
      seen.editor!.setTextCursorPosition("p2", "end")
    })
    act(() => {
      seen.handle!.insertText(" Meta")
    })
    expect(JSON.stringify(client.document()!.blocks[2])).toContain("Meta")
  })

  it.each([
    ["a Coach write", SERVER_ORIGIN],
    ["a rebase write", REBASE_ORIGIN],
  ])("keeps %s when the person presses undo", (_name, origin) => {
    const client = seededLetterClient([
      paragraph("p1", "One"),
      paragraph("p2", "Two"),
    ])
    const { seen } = open(client)
    act(() => {
      seen.editor!.setTextCursorPosition("p1", "end")
      seen.editor!.insertInlineContent([" typed"])
    })
    act(() => {
      const doc = client.document()!
      writeDocument(
        client.ydoc,
        {
          ...doc,
          blocks: doc.blocks.map((block) =>
            block.id === "p2" && "content" in block
              ? { ...block, content: [{ text: "Two WRITTEN" }] }
              : block
          ),
        } as never,
        origin
      )
    })
    act(() => {
      seen.editor!.undo()
    })
    const text = JSON.stringify(client.document())
    expect(text).not.toContain("typed")
    expect(text).toContain("Two WRITTEN")
  })
})
