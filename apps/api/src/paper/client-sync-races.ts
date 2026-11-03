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

export function registerRaces(gc: boolean, half: 0 | 1 | 2) {
  let h: CoachStore

  beforeAll(async () => {
    h = await openCoachStore("user-client-races")
  })

  afterAll(async () => {
    await h.store.client.close()
  })

  let seen = 0
  const scenario = (name: string, run: () => Promise<void>) => {
    const mine = seen++ % 3 === half
    return (mine ? it : it.skip)(name, () => h.inDatabase(run))
  }

  const start = () =>
    newLetter(h, [
      p("p1", "alpha beta"),
      p("p2", "gamma delta"),
      p("p3", "epsilon zeta"),
      li("l1", "parent", [li("l2", "child")]),
    ])

  const addWord = (id: string, word: string) => (doc: PaperDocument) =>
    edited(doc, id, (text) => `${text} ${word}`)

  async function coach(docId: string, edit: Record<string, unknown>) {
    const { revision } = await serverDoc(h, docId)
    return h.coach(docId, revision, [edit])
  }

  async function converge(
    tabs: ReturnType<typeof openTab>[],
    docId: string
  ): Promise<PaperDocument> {
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

  describe(`races the revision guard and the rebase must survive (${gc ? "gc on" : "gc off"})`, () => {
    async function begin(extraTab: boolean) {
      const made = await start()
      const tab = openTab(h, made.docId, { gc })
      await tab.settle(2)
      const other = extraTab ? openTab(h, made.docId, { gc }) : null
      await other?.settle(2)
      return { docId: made.docId, tab, other }
    }

    for (const twoTabs of [false, true]) {
      scenario(
        `a Coach remove, its Undo and typing during an in-flight reply keep one copy (${twoTabs ? "two tabs" : "one tab"})`,
        async () => {
          const { docId, tab, other } = await begin(twoTabs)
          const removed = await coach(docId, { op: "remove", blockId: "p3" })
          await tab.launch()
          await h.run("paper.revertEdit", {
            docId,
            editId: removed.output.editId,
          })
          tab.edit(addWord("p3", "w1x"))
          tab.deliver()
          const doc = await converge(other ? [tab, other] : [tab], docId)
          expect(count(doc, "w1x")).toBe(1)
          expect(count(doc, "epsilon")).toBe(1)
          expect(order(doc).filter((id) => id.startsWith("p3"))).toEqual(["p3"])
        }
      )
    }

    scenario(
      "a block drag meets a second tab's typing in that block",
      async () => {
        const { docId, tab, other } = await begin(true)
        tab.edit((doc) => movedAfter(doc, "p1", "p3"))
        other!.edit(addWord("p1", "TYPEDB"))
        await other!.settle(2)
        const doc = await converge([tab, other!], docId)
        expect(count(doc, "TYPEDB")).toBe(1)
        expect(order(doc).indexOf("p1")).toBeGreaterThan(
          order(doc).indexOf("p3")
        )
      }
    )

    scenario(
      "a drag keeps a Coach rewrite that landed after the last reply",
      async () => {
        const { docId, tab } = await begin(false)
        tab.edit((doc) => movedAfter(doc, "p1", "p3"))
        await coach(docId, {
          op: "setText",
          blockId: "p1",
          text: "alpha beta COACHA",
        })
        const doc = await converge([tab], docId)
        expect(count(doc, "COACHA")).toBe(1)
        expect(order(doc).indexOf("p1")).toBeGreaterThan(
          order(doc).indexOf("p3")
        )
      }
    )

    scenario(
      "a drag does not bring back a block the Coach removed beside it",
      async () => {
        const { docId, tab } = await begin(false)
        tab.edit((doc) => movedAfter(doc, "p1", "p3"))
        await coach(docId, { op: "remove", blockId: "p2" })
        const doc = await converge([tab], docId)
        expect(order(doc)).toEqual(["p3", "p1", "l1"])
      }
    )

    scenario(
      "a drag to the top does not bring back a removed first block",
      async () => {
        const { docId, tab } = await begin(false)
        tab.edit((doc) => movedAfter(doc, "p3", null))
        await coach(docId, { op: "remove", blockId: "p1" })
        const doc = await converge([tab], docId)
        expect(order(doc)).toEqual(["p3", "p2", "l1"])
      }
    )

    scenario(
      "the person's drag survives a Coach move of a neighbour and an edit of the dragged block",
      async () => {
        const { docId, tab } = await begin(false)
        tab.edit((doc) => movedAfter(doc, "p3", null))
        await coach(docId, { op: "move", blockId: "p1", after: "p2" })
        await coach(docId, {
          op: "setText",
          blockId: "p3",
          text: "epsilon zeta COACHC",
        })
        const doc = await converge([tab], docId)
        expect(order(doc)[0]).toBe("p3")
        expect(textOf(doc, "p3")).toBe("epsilon zeta COACHC")
      }
    )

    scenario(
      "a delayed reply with typing while the push is in flight keeps each word once",
      async () => {
        const { docId, tab } = await begin(false)
        tab.edit(addWord("p1", "first"))
        await tab.launch()
        tab.edit(addWord("p1", "second"))
        await coach(docId, {
          op: "setText",
          blockId: "p2",
          text: "gamma delta COACHD",
        })
        tab.deliver()
        const doc = await converge([tab], docId)
        for (const word of ["first", "second", "COACHD"]) {
          expect(count(doc, word)).toBe(1)
        }
      }
    )

    scenario(
      "a long block keeps the Coach text and the person's text once each",
      async () => {
        const { docId, tab } = await begin(false)
        const long = (ch: string) => `${ch.repeat(2400)} end`
        tab.edit((doc) => edited(doc, "p3", () => long("a")))
        await tab.settle(2)
        tab.edit((doc) => edited(doc, "p3", () => long("b")))
        await coach(docId, { op: "setText", blockId: "p3", text: long("c") })
        const doc = await converge([tab], docId)
        const text = (doc.blocks as unknown as { id: string }[])
          .map((block) => textOf(doc, block.id) ?? "")
          .join("|")
        expect(text.split("b".repeat(2400)).length - 1).toBe(1)
        expect(text.split("c".repeat(2400)).length - 1).toBe(1)
      }
    )
  })
}
