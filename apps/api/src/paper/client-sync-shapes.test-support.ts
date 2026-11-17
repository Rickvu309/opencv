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
  without,
  wordsOf,
} from "../test/paper-client.js"

export function registerShapes(gc: boolean, half: 0 | 1 | 2) {
  const userId = "user-client-sync"
  let h: CoachStore

  beforeAll(async () => {
    h = await openCoachStore(userId)
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
      p("p3", "epsilon"),
      li("l1", "parent", [li("l2", "child")]),
    ])

  async function coachMove(docId: string, blockId: string, after: string) {
    const { revision } = await serverDoc(h, docId)
    return h.coach(docId, revision, [{ op: "move", blockId, after }])
  }

  async function coachSet(docId: string, blockId: string, text: string) {
    const { revision } = await serverDoc(h, docId)
    return h.coach(docId, revision, [{ op: "setText", blockId, text }])
  }

  async function coachRemove(docId: string, blockId: string) {
    const { revision } = await serverDoc(h, docId)
    return h.coach(docId, revision, [{ op: "remove", blockId }])
  }

  async function converge(tabs: ReturnType<typeof openTab>[], docId: string) {
    for (const tab of tabs) await tab.settle(3)
    for (const tab of tabs) await tab.settle(2)
    const { doc } = await serverDoc(h, docId)
    for (const tab of tabs) {
      expect(tab.doc().blocks).toEqual(doc.blocks)
    }
    return doc
  }

  const addWord = (id: string, word: string) => (doc: PaperDocument) =>
    edited(doc, id, (text) => `${text} ${word}`)

  describe(`the client keeps pending typing (${gc ? "gc on" : "gc off"})`, () => {
    async function begin() {
      const made = await start()
      const tab = openTab(h, made.docId, { gc })
      await tab.settle(2)
      return { docId: made.docId, tab }
    }

    scenario("chained updates in a block the Coach moved", async () => {
      const { docId, tab } = await begin()
      tab.edit(addWord("p1", "one"))
      tab.edit(addWord("p1", "two"))
      await coachMove(docId, "p1", "p3")
      const doc = await converge([tab], docId)
      expect(count(doc, "one")).toBe(1)
      expect(count(doc, "two")).toBe(1)
      expect(order(doc).indexOf("p1")).toBeGreaterThan(order(doc).indexOf("p3"))
    })

    scenario(
      "Enter in the middle of a block the Coach moved (Y1) keeps each word once",
      async () => {
        const { docId, tab } = await begin()
        tab.edit((doc) => {
          const split = edited(doc, "p1", () => "alpha")
          return {
            ...split,
            blocks: [
              split.blocks[0],
              p("n1", "beta"),
              ...split.blocks.slice(1),
            ],
          } as never
        })
        await coachMove(docId, "p1", "p3")
        const doc = await converge([tab], docId)
        expect(count(doc, "alpha")).toBe(1)
        expect(count(doc, "beta")).toBe(1)
        expect(order(doc)).toContain("n1")
      }
    )

    scenario(
      "Backspace joining two blocks while the Coach removed the second",
      async () => {
        const { docId, tab } = await begin()
        tab.edit((doc) =>
          without(
            edited(doc, "p1", (text) => `${text} gamma delta`),
            "p2"
          )
        )
        await coachRemove(docId, "p2")
        const doc = await converge([tab], docId)
        expect(count(doc, "gamma")).toBe(1)
        expect(count(doc, "delta")).toBe(1)
        expect(order(doc)).not.toContain("p2")
      }
    )

    scenario(
      "typing in a nested bullet whose parent the Coach removed brings the parent back",
      async () => {
        const { docId, tab } = await begin()
        tab.edit(addWord("l2", "typed"))
        await coachRemove(docId, "l1")
        const doc = await converge([tab], docId)
        expect(textOf(doc, "l2")).toBe("child typed")
        expect(order(doc)).toContain("l1")
      }
    )

    scenario(
      "typing into the only child after the Coach removed it puts it back inside its parent",
      async () => {
        const { docId, tab } = await begin()
        tab.edit(addWord("l2", "again"))
        await coachRemove(docId, "l2")
        const doc = await converge([tab], docId)
        expect(textOf(doc, "l2")).toBe("child again")
        const parent = doc.blocks.find((block) => block.id === "l1") as {
          children: { id: string }[]
        }
        expect(parent.children.map((child) => child.id)).toEqual(["l2"])
      }
    )

    scenario(
      "an in-flight delete of text in a block the Coach moved",
      async () => {
        const { docId, tab } = await begin()
        tab.edit((doc) => edited(doc, "p1", () => "beta"))
        await coachMove(docId, "p1", "p3")
        const doc = await converge([tab], docId)
        expect(textOf(doc, "p1")).toBe("beta")
      }
    )

    scenario(
      "an in-flight delete of a whole block the Coach moved",
      async () => {
        const { docId, tab } = await begin()
        tab.edit((doc) => without(doc, "p2"))
        await coachMove(docId, "p2", "p3")
        const doc = await converge([tab], docId)
        expect(order(doc)).not.toContain("p2")
      }
    )

    scenario("a mark-only change in a block the Coach moved", async () => {
      const { docId, tab } = await begin()
      tab.edit(
        (doc) =>
          ({
            ...doc,
            blocks: doc.blocks.map((block) =>
              block.id === "p1"
                ? {
                    ...block,
                    content: [{ text: "alpha " }, { text: "beta", bold: true }],
                  }
                : block
            ),
          }) as never
      )
      await coachMove(docId, "p1", "p3")
      const doc = await converge([tab], docId)
      const block = doc.blocks.find((b) => b.id === "p1") as unknown as {
        content: { text: string; bold?: boolean }[]
      }
      expect(block.content).toContainEqual({ text: "beta", bold: true })
      expect(textOf(doc, "p1")).toBe("alpha beta")
    })

    scenario("applies a reply before the typing is flushed", async () => {
      const { docId, tab } = await begin()
      await coachMove(docId, "p1", "p3")
      await tab.launch()
      tab.edit(addWord("p1", "late"))
      tab.deliver()
      const doc = await converge([tab], docId)
      expect(count(doc, "late")).toBe(1)
      expect(order(doc).indexOf("p1")).toBeGreaterThan(order(doc).indexOf("p3"))
    })

    scenario("two tabs edit one document next to the Coach", async () => {
      const { docId, tab } = await begin()
      const other = openTab(h, docId, { gc })
      await other.settle(2)
      tab.edit(addWord("p1", "fromA"))
      other.edit(addWord("p2", "fromB"))
      other.edit(addWord("p1", "bothB"))
      await coachMove(docId, "p1", "p3")
      await tab.launch()
      await other.launch()
      tab.edit(addWord("p3", "moreA"))
      tab.deliver()
      other.deliver()
      const doc = await converge([tab, other], docId)
      for (const word of ["fromA", "fromB", "bothB", "moreA"]) {
        expect(count(doc, word)).toBe(1)
      }
    })

    scenario(
      "Undo of a move keeps the typing in the moved block once",
      async () => {
        const { docId, tab } = await begin()
        const moved = await coachMove(docId, "p1", "p3")
        await tab.settle(1)
        tab.edit(addWord("p1", "during"))
        await tab.settle(1)
        await h.run("paper.revertEdit", {
          docId,
          editId: moved.output.editId,
        })
        tab.edit(addWord("p1", "after"))
        const doc = await converge([tab], docId)
        expect(count(doc, "during")).toBe(1)
        expect(count(doc, "after")).toBe(1)
        expect(order(doc).filter((id) => id === "p1")).toHaveLength(1)
      }
    )

    scenario(
      "typed and deleted in one update in a live block does not double",
      async () => {
        const { docId, tab } = await begin()
        tab.edit((doc) => edited(doc, "p1", () => "beta typed"))
        await coachSet(docId, "p2", "gamma delta coach")
        const doc = await converge([tab], docId)
        expect(wordsOf(doc).filter((word) => word === "typed")).toHaveLength(1)
        expect(textOf(doc, "p1")).toBe("beta typed")
        expect(count(doc, "coach")).toBe(1)
      }
    )

    scenario(
      "forged, empty and old state vectors on a push change nothing",
      async () => {
        const { docId, tab } = await begin()
        tab.edit(addWord("p1", "forge"))
        await tab.round(new Uint8Array())
        tab.edit(addWord("p2", "forge2"))
        await tab.round(new Uint8Array([0]))
        tab.edit(addWord("p3", "forge3"))
        await tab.round(new Uint8Array())
        const doc = await converge([tab], docId)
        for (const word of ["forge", "forge2", "forge3"]) {
          expect(count(doc, word)).toBe(1)
        }
      }
    )

    scenario(
      "keeps typing after a push that needed a repair, and a whole-state resend",
      async () => {
        const { docId, tab } = await begin()
        tab.edit((doc) => ({
          ...doc,
          blocks: [
            li("d1", "one", [
              li("d2", "two", [li("d3", "three", [li("d4", "four")])]),
            ]),
            ...doc.blocks,
          ] as never,
        }))
        await tab.round()
        tab.edit(addWord("d3", "typed"))
        const resend = tab.client.state()
        await h.run("paper.sync", {
          docId,
          epoch: 1,
          update: Buffer.from(resend).toString("base64"),
          stateVector: "",
        })
        const doc = await converge([tab], docId)
        expect(count(doc, "typed")).toBe(1)
        expect(count(doc, "four")).toBe(1)
        expect(new Set(wordsOf(doc)).size).toBeGreaterThan(5)
      }
    )

    scenario(
      "the person drags a block while the Coach rewrites it, so both survive",
      async () => {
        const { docId, tab } = await begin()
        tab.edit((doc) => movedAfter(doc, "p1", "p3"))
        await coachSet(docId, "p1", "alpha beta coachword")
        const doc = await converge([tab], docId)
        expect(textOf(doc, "p1")).toBe("alpha beta coachword")
        expect(order(doc).indexOf("p1")).toBeGreaterThan(
          order(doc).indexOf("p3")
        )
        expect(order(doc).filter((id) => id === "p1")).toHaveLength(1)
      }
    )

    scenario(
      "the person deletes a block while the Coach rewrites it, so the Coach's version stays",
      async () => {
        const { docId, tab } = await begin()
        tab.edit((doc) => without(doc, "p2"))
        await coachSet(docId, "p2", "gamma delta rewritten")
        const doc = await converge([tab], docId)
        expect(textOf(doc, "p2")).toBe("gamma delta rewritten")
      }
    )

    scenario(
      "the person's drag and the Coach's move of one block leave one block where the server put it",
      async () => {
        const { docId, tab } = await begin()
        tab.edit((doc) => movedAfter(doc, "p1", "p3"))
        await coachMove(docId, "p1", "p2")
        const doc = await converge([tab], docId)
        expect(order(doc).filter((id) => id === "p1")).toHaveLength(1)
        expect(order(doc).indexOf("p1")).toBe(order(doc).indexOf("p2") + 1)
      }
    )

    scenario(
      "a long block keeps both versions rather than dropping one",
      async () => {
        const { docId, tab } = await begin()
        const long = (ch: string) => `${ch.repeat(2400)} end`
        tab.edit((doc) => edited(doc, "p3", () => long("a")))
        await tab.settle(2)
        const other = openTab(h, docId, { gc })
        await other.settle(2)
        tab.edit((doc) => edited(doc, "p3", () => long("b")))
        await coachSet(docId, "p3", long("c"))
        const doc = await converge([tab, other], docId)
        const texts = (doc.blocks as unknown as { id: string }[])
          .map((block) => textOf(doc, block.id) ?? "")
          .join("|")
        expect(texts).toContain("b".repeat(2400))
      }
    )
  })
}
