import { BlockNoteEditor } from "@blocknote/core"
import { _blocksToProsemirrorNode } from "@blocknote/core/yjs"
import { letterSchema } from "@workspace/paper-crdt"
import { ySyncPluginKey } from "y-prosemirror"
import { describe, expect, it } from "vitest"

import { letterRulesPlugin, letterViolations } from "./letter-rules.ts"
import { normalizeHref } from "./link-href.ts"

const editor = BlockNoteEditor.create({ schema: letterSchema })

const item = (text: string, children: unknown[] = []) => ({
  type: "bulletListItem",
  content: text,
  children,
})

const docOf = (blocks: unknown[]) =>
  _blocksToProsemirrorNode(editor, blocks as never)

const filter = (before: unknown[], after: unknown[], meta?: boolean) =>
  letterRulesPlugin.spec.filterTransaction!(
    {
      docChanged: true,
      doc: docOf(after),
      getMeta: (key: unknown) =>
        meta && key === ySyncPluginKey ? {} : undefined,
    } as never,
    { doc: docOf(before) } as never
  )

const deep = [item("a", [item("b", [item("c", [item("d")])])])]
const ok = [item("a", [item("b", [item("c")])])]

describe("the letter rules", () => {
  it("counts nesting past three and children under a paragraph", () => {
    expect(letterViolations(docOf(ok))).toBe(0)
    expect(letterViolations(docOf(deep))).toBe(1)
    expect(
      letterViolations(
        docOf([{ type: "paragraph", content: "x", children: [item("kid")] }])
      )
    ).toBe(1)
  })

  it("rejects a local change that adds a violation", () => {
    expect(filter(ok, deep)).toBe(false)
  })

  it("still rejects a new violation when the document already holds one", () => {
    const twice = [
      ...deep,
      { type: "paragraph", content: "x", children: [item("kid")] },
    ]
    expect(filter(deep, twice)).toBe(false)
    expect(filter(deep, deep)).toBe(true)
  })

  it("never rejects a change that carries the sync meta", () => {
    expect(filter(ok, deep, true)).toBe(true)
  })
})

describe("the link bar address", () => {
  it.each([
    ["example.com", "https://example.com"],
    ["  http://a.test/x ", "http://a.test/x"],
    ["me@example.com", "mailto:me@example.com"],
    ["mailto:me@example.com", "mailto:me@example.com"],
    ["javascript:alert(1)", null],
    ["", null],
  ])("turns %s into %s", (raw, wanted) => {
    expect(normalizeHref(raw)).toBe(wanted)
  })
})
