import { afterEach, expect, it } from "vitest"
import * as Y from "yjs"
import { nativeProvenance } from "@workspace/domain/paper-doc"
import { openRichPaperClient, type Stored } from "./client.js"
import { emptyUpdate } from "./sync.js"
import { recoverRichPaperClient } from "./rich-recovery.js"
import { seedStoredYDoc } from "./stored-document.js"
import { storedFlowFixture } from "./test/flow-fixture.js"

const clients = new Set<ReturnType<typeof openRichPaperClient>>()
afterEach(() => {
  for (const client of clients) client.destroy()
  clients.clear()
})
function admitted(kind: "cv" | "letter"): Stored {
  const document = storedFlowFixture(kind)
  return {
    epoch: 1,
    revision: 0,
    provenance: nativeProvenance(document),
    server: seedStoredYDoc(document),
    pending: emptyUpdate(),
  }
}
function open(stored: Stored) {
  const client = openRichPaperClient(stored, { provenance: stored.provenance! })
  clients.add(client)
  return client
}
function type(doc: Y.Doc, value: string) {
  const visit = (fragment: Y.XmlFragment): boolean => {
    for (const child of fragment.toArray()) {
      if (child instanceof Y.XmlText && child.length > 0) {
        child.insert(child.length, value)
        return true
      }
      if (child instanceof Y.XmlElement && visit(child)) return true
    }
    return false
  }
  const fragment = doc.getXmlFragment(
    doc.getMap("paper").get("kind") === "cv"
      ? "private-native-cv-v4-r2"
      : "document-store"
  )
  if (!visit(fragment)) throw new Error("Missing text")
}

it.each(["cv", "letter"] as const)(
  "recovers the newest exact %s checkpoint without rebuilding its content",
  (kind) => {
    const saved = admitted(kind)
    const client = open(saved)
    type(client.ydoc, " first Việt 😀")
    const first = client.stored()
    type(client.ydoc, " second")
    const latest = client.stored()
    const recovered = recoverRichPaperClient(
      saved,
      [latest, first],
      saved.provenance!
    )
    clients.add(recovered)
    expect(recovered.document()).toEqual(client.document())
    expect(recovered.hasPending()).toBe(true)
    expect(recovered.rebuilds).toBe(0)
    expect(recovered.stored().pending).toEqual(latest.pending)
  }
)

it("drops only edits already included in the admitted server", () => {
  const saved = admitted("letter")
  const client = open(saved)
  type(client.ydoc, " acknowledged")
  const checkpoint = client.stored()
  const next = { ...saved, revision: 1, server: client.state() }
  const recovered = recoverRichPaperClient(
    next,
    [checkpoint],
    saved.provenance!
  )
  clients.add(recovered)
  expect(recovered.document()).toEqual(client.document())
  expect(recovered.hasPending()).toBe(false)
})

it.each(["epoch", "divergent", "foreign"] as const)(
  "refuses %s recovery and leaves every original checkpoint byte untouched",
  (mistake) => {
    const saved = admitted("letter")
    const first = open(saved)
    const second = open(saved)
    type(first.ydoc, " first")
    type(second.ydoc, " second")
    const checkpoint = first.stored()
    const before = structuredClone(checkpoint)
    const remote =
      mistake === "foreign"
        ? { ...saved, revision: 1, server: second.state() }
        : mistake === "epoch"
          ? { ...saved, epoch: 2 }
          : saved
    const checkpoints =
      mistake === "divergent" ? [checkpoint, second.stored()] : [checkpoint]
    expect(() =>
      recoverRichPaperClient(remote, checkpoints, saved.provenance!)
    ).toThrow(/kept/)
    expect(checkpoint).toEqual(before)
  }
)

it("releases mounted consumers before closing the owned document exactly once", () => {
  const client = open(admitted("letter"))
  const events: string[] = []
  client.onDocumentRelease(() => events.push("editor"))
  client.ydoc.on("destroy", () => events.push("document"))
  client.destroy()
  client.destroy()
  expect(events).toEqual(["editor", "document"])
  expect(() => client.prepare()).toThrow("closed")
})
