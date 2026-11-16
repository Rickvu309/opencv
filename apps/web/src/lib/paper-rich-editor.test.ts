import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { nativeProvenance } from "@workspace/domain"
import {
  emptyUpdate,
  openRichPaperClient,
  seedStoredYDoc,
} from "@workspace/paper-crdt"
import { mountRichPaperEditor } from "@workspace/paper-crdt/editor"
import { storedFlowFixture } from "../../../../packages/paper-crdt/src/test/flow-fixture.ts"

const cleanups = new Set<() => void>()
beforeEach(() => {
  vi.stubGlobal("ClipboardEvent", class extends Event {})
  Object.defineProperties(Range.prototype, {
    getClientRects: { configurable: true, value: () => [] },
    getBoundingClientRect: { configurable: true, value: () => new DOMRect() },
  })
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { ready: Promise.resolve() },
  })
})
afterEach(() => {
  for (const cleanup of cleanups) cleanup()
  cleanups.clear()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it.each(["cv", "letter"] as const)(
  "edits the owned %s document and releases the editor before client destruction",
  async (kind) => {
    const document = storedFlowFixture(kind)
    const client = openRichPaperClient(
      {
        epoch: 1,
        revision: 0,
        provenance: nativeProvenance(document),
        server: seedStoredYDoc(document),
        pending: emptyUpdate(),
      },
      { provenance: nativeProvenance(document) }
    )
    const host = window.document.createElement("div")
    window.document.body.append(host)
    const mounted = mountRichPaperEditor(client, host)
    cleanups.add(() => {
      mounted.destroy()
      client.destroy()
      host.remove()
    })
    expect(host.getAttribute("aria-label")).toBe("Document content")
    mounted.focus()
    mounted.toggleMark("underline")
    expect(mounted.activeMarks().underline).toBe(true)
    const paste = new Event("paste", { bubbles: true, cancelable: true })
    Object.defineProperty(paste, "clipboardData", {
      value: {
        getData: (name: string) =>
          name === "text/plain" ? "Saved Việt 😀 " : "",
        types: ["text/plain"],
        files: [],
      },
    })
    host.dispatchEvent(paste)
    await vi.waitFor(() =>
      expect(JSON.stringify(client.document())).toContain("Saved Việt 😀")
    )
    expect(client.hasPending()).toBe(true)
    const stored = client.stored()
    const reopened = openRichPaperClient(stored, {
      provenance: stored.provenance!,
    })
    try {
      expect(reopened.document()).toEqual(client.document())
    } finally {
      reopened.destroy()
    }
    mounted.setEditable(false)
    const blocked = client.document()
    mounted.toggleMark("bold")
    host.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "b",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      })
    )
    expect(client.document()).toEqual(blocked)
    client.destroy()
    expect(() => mounted.toggleMark("bold")).not.toThrow()
    expect(host.childElementCount).toBe(0)
  }
)
