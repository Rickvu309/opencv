import type { PaperDocument } from "@workspace/domain"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { openCoachStore, type CoachStore } from "../test/paper-coach.js"
import {
  count,
  edited,
  li,
  movedAfter,
  newLetter,
  openTab,
  order,
  p,
  serverDoc,
  textOf,
} from "../test/paper-client.js"

let h: CoachStore

beforeAll(async () => {
  h = await openCoachStore("user-client-review3")
})

afterAll(async () => {
  await h.store.client.close()
})

const scenario = (name: string, run: () => Promise<void>) =>
  it(name, () => h.inDatabase(run))

const start = () =>
  newLetter(h, [
    p("p1", "alpha one"),
    p("p2", "alpha two"),
    p("p3", "gamma three"),
    li("l1", "parent", [li("l2", "child")]),
  ])

const addWord = (id: string, word: string) => (doc: PaperDocument) =>
  edited(doc, id, (text) => `${text} ${word}`)

async function coach(docId: string, edit: Record<string, unknown>) {
  const { revision } = await serverDoc(h, docId)
  return h.coach(docId, revision, [edit])
}

async function converge(tabs: ReturnType<typeof openTab>[], docId: string) {
  for (let n = 0; n < 3; n += 1) {
    for (const tab of tabs) {
      if (tab.inFlight) tab.deliver()
      await tab.settle(2)
    }
  }
  const { doc } = await serverDoc(h, docId)
  for (const tab of tabs) expect(tab.doc().blocks).toEqual(doc.blocks)
  return doc
}

describe("review 3 probes on the editor's real Yjs shape", () => {
  scenario(
    "a drag renames containers in place and keeps every id",
    async () => {
      const { docId, tab } = await start()
      tab.edit((doc) => movedAfter(doc, "p1", "p2"))
      const doc = await converge([tab], docId)
      expect(order(doc)).toEqual(["p2", "p1", "p3", "l1"])
      expect(textOf(doc, "p1")).toBe("alpha one")
      expect(textOf(doc, "p2")).toBe("alpha two")
    }
  )

  for (const [name, text] of [
    ["appends to", "alpha one COACH"],
    ["recases", "Alpha one"],
  ] as const) {
    scenario(
      `a Coach edit that ${name} p1 lands in p1 after the person dragged p1`,
      async () => {
        const { docId, tab } = await start()
        tab.edit((doc) => movedAfter(doc, "p1", "p2"))
        await coach(docId, { op: "setText", blockId: "p1", text })
        const doc = await converge([tab], docId)
        expect(textOf(doc, "p1")).toBe(text)
        expect(textOf(doc, "p2")).toBe("alpha two")
      }
    )
  }

  scenario(
    "a Coach remove of a neighbour holds while the person swaps p1 down",
    async () => {
      const { docId, tab } = await start()
      tab.edit((doc) => movedAfter(doc, "p1", "p2"))
      await coach(docId, { op: "remove", blockId: "p2" })
      const doc = await converge([tab], docId)
      expect(order(doc)).toEqual(["p1", "p3", "l1"])
      expect(textOf(doc, "p1")).toBe("alpha one")
    }
  )

  scenario(
    "a push the server absorbed but never acknowledged keeps the Coach text after a drag",
    async () => {
      const { docId, tab } = await start()
      tab.edit(addWord("p1", "AAA"))
      await tab.launch()
      await coach(docId, {
        op: "setText",
        blockId: "p1",
        text: "alpha one AAA COACHZ",
      })
      tab.edit((doc) => movedAfter(doc, "p1", "p3"))
      const doc = await converge([tab], docId)
      expect(count(doc, "COACHZ")).toBe(1)
      expect(count(doc, "AAA")).toBe(1)
    }
  )

  scenario(
    "a Coach move that changes nothing still keeps the typing in that block",
    async () => {
      const { docId, tab } = await start()
      tab.edit(addWord("p3", "TYPED"))
      await coach(docId, { op: "move", blockId: "p3", after: "l1" })
      const doc = await converge([tab], docId)
      expect(textOf(doc, "p3")).toBe("gamma three TYPED")
    }
  )

  scenario(
    "a Coach setText at an older revision, after the person dragged p1, lands in p1 or is stale, never in p2",
    async () => {
      const { docId, tab } = await start()
      const { revision } = await serverDoc(h, docId)
      tab.edit((doc) => movedAfter(doc, "p1", "p3"))
      await tab.settle(2)
      const result = await h.coach(docId, revision, [
        { op: "setText", blockId: "p1", text: "alpha one OLDREAD" },
      ])
      const { doc } = await serverDoc(h, docId)
      expect(textOf(doc, "p2")).toBe("alpha two")
      expect(textOf(doc, "p3")).toBe("gamma three")
      const landed = textOf(doc, "p1") === "alpha one OLDREAD"
      const stale = result.output.outcomes.some((o) => o.status === "stale")
      expect(landed || stale).toBe(true)
    }
  )

  scenario(
    "Undo of a Coach edit after the person dragged that block takes out only the Coach words or refuses",
    async () => {
      const { docId, tab } = await start()
      const edit = await coach(docId, {
        op: "setText",
        blockId: "p1",
        text: "alpha one UNDOME",
      })
      await tab.settle(2)
      tab.edit((doc) => movedAfter(doc, "p1", "p3"))
      await tab.settle(2)
      let refused = false
      try {
        await h.run("paper.revertEdit", { docId, editId: edit.output.editId })
      } catch {
        refused = true
      }
      const { doc } = await serverDoc(h, docId)
      expect(textOf(doc, "p2")).toBe("alpha two")
      expect(textOf(doc, "p3")).toBe("gamma three")
      expect(textOf(doc, "p1")).toBe(refused ? "alpha one UNDOME" : "alpha one")
    }
  )

  scenario(
    "typing survives an editor document that garbage-collects (gc on)",
    async () => {
      const made = await start()
      const tab = openTab(h, made.docId, { gc: true })
      await tab.settle(2)
      tab.edit(addWord("p1", "GCTYPED"))
      await coach(made.docId, { op: "move", blockId: "p1", after: "p3" })
      tab.edit(addWord("p1", "GCMORE"))
      const doc = await converge([tab], made.docId)
      expect(textOf(doc, "p1")).toContain("GCTYPED")
      expect(textOf(doc, "p1")).toContain("GCMORE")
      expect(count(doc, "GCTYPED")).toBe(1)
    }
  )
})
