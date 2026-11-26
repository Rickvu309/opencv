import { afterEach, expect, it } from "vitest"
import * as Y from "yjs"
import {
  canonicalPaper,
  nativeProvenance,
  richPaperDocumentSchema,
} from "@workspace/domain/paper-doc"
import { openRichPaperClient } from "./client.js"
import { PENDING_CONTENT_ORIGIN } from "./pending-content.js"
import { materializeStored, seedStoredYDoc } from "./stored-document.js"
import { storedFlowFixture } from "./test/flow-fixture.js"

const cleanup: (() => void)[] = []
afterEach(() => {
  for (const close of cleanup.splice(0)) close()
})
function element(parent: Y.XmlFragment, id: string): Y.XmlElement {
  for (const node of parent.createTreeWalker(() => true))
    if (node instanceof Y.XmlElement && node.getAttribute("id") === id)
      return node
  throw new Error(`Missing block ${id}`)
}
function text(parent: Y.XmlFragment): Y.XmlText {
  for (const node of parent.createTreeWalker(() => true))
    if (node instanceof Y.XmlText) return node
  throw new Error("Missing text")
}
const cases = [
  { kind: "cv", target: "intro", remove: "intro" },
  { kind: "letter", target: "intro", remove: "intro" },
  { kind: "cv", target: "r1-a-p", remove: "r1" },
  { kind: "letter", target: "r1-a-p", remove: "table" },
  { kind: "cv", target: "intro", remove: "intro", list: true },
  { kind: "letter", target: "intro", remove: "intro", list: true },
  { kind: "cv", target: "header-name", remove: "header" },
] as const

it.each(
  cases.flatMap((entry) => [true, false].map((stale) => ({ ...entry, stale })))
)(
  "preserves pending $kind $target words when $remove is deleted (stale: $stale)",
  ({ kind, target, remove, stale, ...options }) => {
    const fixture = storedFlowFixture(kind)
    if ("list" in options) {
      const section = fixture.flow.children[0]!
      const paragraph = section.children.find((node) => node.id === "intro")!
      Object.assign(paragraph, { type: "bullet", children: [] })
    }
    const remote = new Y.Doc({ gc: false })
    cleanup.push(() => remote.destroy())
    Y.applyUpdate(remote, seedStoredYDoc(fixture))
    const provenance = nativeProvenance(fixture)
    const reply = (revision = 0, stale = false) => ({
      provenance,
      epoch: 1,
      revision,
      reset: false,
      stale,
      update: Y.encodeStateAsUpdate(remote),
      stateVector: Y.encodeStateVector(remote),
    })
    const a = openRichPaperClient(null, { provenance })
    const b = openRichPaperClient(null, { provenance })
    cleanup.push(
      () => a.destroy(),
      () => b.destroy()
    )
    for (const client of [a, b])
      expect(client.receive(client.prepare(), reply()).failed).toBe(false)
    const root = kind === "cv" ? "private-native-cv-v4-r2" : "document-store"
    const fragment = b.ydoc.getXmlFragment(root)
    const history = new Y.UndoManager(fragment, {
      trackedOrigins: new Set([PENDING_CONTENT_ORIGIN]),
      captureTimeout: 0,
    })
    cleanup.push(() => history.destroy())
    const pull = b.prepare({ pullOnly: true })
    const content = text(element(fragment, target))
    const words = " UNIQUE_UNSAVED_WORDS Việt 東京 😀"
    content.insert(content.length, words, {
      bold: { stringValue: "on" },
      italic: { stringValue: "on" },
    })
    const sent = b.prepare()
    content.insert(content.length, " DURING_SAVE", {
      underline: { stringValue: "on" },
    })
    const removed = element(a.ydoc.getXmlFragment(root), remove)
    const parent = removed.parent
    if (!(parent instanceof Y.XmlFragment))
      throw new Error("Missing container parent")
    const index = parent.toArray().indexOf(removed)
    const replacement = remove === "header" ? removed.clone() : undefined
    parent.delete(index, 1)
    if (replacement) {
      parent.insert(index, [replacement])
      const name = text(element(replacement, "header-name"))
      name.delete(0, name.length)
    }
    const deletion = a.prepare()
    Y.applyUpdate(remote, deletion.update)
    expect(materializeStored(remote).ok).toBe(true)
    expect(a.receive(deletion, reply(1)).failed).toBe(false)
    const changes: string[] = []
    b.subscribe((change) => changes.push(change))
    expect(b.receive(stale ? sent : pull, reply(1, stale)).failed).toBe(false)
    expect(changes).toContain("local")
    expect(b.hasPending()).toBe(true)
    const restored = b.document()!
    expect(canonicalPaper(restored)).toContain(words)
    expect(canonicalPaper(restored)).toContain("DURING_SAVE")
    const section = restored.flow.children[0]!
    const recovered = section.children.filter((node) =>
      node.id.startsWith("pending-")
    )
    expect(recovered).toHaveLength(1)
    expect(JSON.stringify(recovered)).not.toContain("Linh")
    expect(JSON.stringify(recovered)).not.toContain("Việt e")
    if (remove === "intro")
      expect(section.children[kind === "cv" ? 1 : 0]).toEqual(recovered[0])
    expect(recovered[0]).toMatchObject({
      type: "paragraph",
      content: expect.arrayContaining([
        expect.objectContaining({ text: words, bold: true, italic: true }),
      ]),
    })
    if (remove === "r1") {
      const tableAt = section.children.findIndex((node) => node.id === "table")
      expect(section.children[tableAt + 1]).toEqual(recovered[0])
    }
    expect(history.canUndo()).toBe(true)
    history.undo()
    expect(canonicalPaper(b.document()!)).not.toContain(words)
    history.redo()
    expect(canonicalPaper(b.document()!)).toContain(words)
    const retry = b.prepare()
    Y.applyUpdate(remote, retry.update)
    expect(b.receive(retry, reply(2)).failed).toBe(false)
    expect(b.hasPending()).toBe(false)
    expect(a.receive(a.prepare(), reply(2)).failed).toBe(false)
    const stored = materializeStored(remote)
    expect(stored.ok).toBe(true)
    if (!stored.ok) throw new Error(stored.reason)
    expect(richPaperDocumentSchema.safeParse(stored.document).success).toBe(
      true
    )
    const expected = canonicalPaper(stored.document)
    expect(expected).toContain(words)
    expect(expected).toContain("DURING_SAVE")
    expect(canonicalPaper(a.document()!)).toBe(expected)
    expect(canonicalPaper(b.document()!)).toBe(expected)
    const reopened = openRichPaperClient(b.stored(), { provenance })
    cleanup.push(() => reopened.destroy())
    expect(canonicalPaper(reopened.document()!)).toBe(expected)
    expect(reopened.hasPending()).toBe(false)
    expect(b.rebuilds).toBe(0)
  }
)
