import { IDBFactory } from "fake-indexeddb"
import { paperEngineBlank } from "@workspace/domain/paper-doc"
import { createEngine, fixedClock, seededIds } from "@workspace/paper-engine"
import { describe, expect, it } from "vitest"

import { indexedDbPendingStore } from "./paper-pending-store.ts"

const DOC = "00000000-0000-4000-8000-000000000002"

function typedRecord(writer: string) {
  const engine = createEngine({ ids: seededIds(writer), now: fixedClock() })
  const doc = paperEngineBlank.blankCv()
  const pos = { block: doc.content[0]!.attrs.id, offset: 0 }
  const typed = engine.run(
    engine.load(doc, 0, writer),
    [{ op: "insertText", range: { from: pos, to: pos }, text: "Kept" }],
    { kind: "person", actor: "ada", client: writer }
  )
  if ("refusal" in typed) throw new Error("typing refused")
  return { docId: DOC, writer, ...engine.saved(typed.state) }
}

describe("the device copy of unsent Paper edits", () => {
  it("keeps each writer's edits for a Paper across a reopen", async () => {
    const factory = new IDBFactory()
    const first = indexedDbPendingStore(factory)
    await first.put(typedRecord("tab-a"))
    await first.put(typedRecord("tab-b"))
    await first.keepRecovered(DOC, ["Lost words"])

    const reopened = indexedDbPendingStore(factory)
    expect((await reopened.writers(DOC)).sort()).toEqual(["tab-a", "tab-b"])
    const loaded = await reopened.load(DOC, "tab-a")
    expect(loaded?.pending).toHaveLength(1)
    expect(loaded?.version).toBe(0)
    expect(await reopened.recovered(DOC)).toEqual(["Lost words"])

    await reopened.drop(DOC, "tab-a")
    await reopened.keepRecovered(DOC, [])
    expect(await reopened.load(DOC, "tab-a")).toBeNull()
    expect(await reopened.writers(DOC)).toEqual(["tab-b"])
    expect(await reopened.recovered(DOC)).toEqual([])
  })

  it("ignores a row that is not a pending record", async () => {
    const factory = new IDBFactory()
    const store = indexedDbPendingStore(factory)
    await store.put({ ...typedRecord("tab-a"), version: -1 })
    expect(await store.load(DOC, "tab-a")).toBeNull()
    expect(await store.writers(DOC)).toEqual([])
  })
})
