import type { PaperDocument } from "@workspace/domain"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { openCoachStore, type CoachStore } from "../test/paper-coach.js"
import {
  count,
  flat,
  newLetter,
  openTab,
  p,
  serverDoc,
} from "../test/paper-client.js"

let h: CoachStore

beforeAll(async () => {
  h = await openCoachStore("user-client-review7")
})

afterAll(async () => {
  await h.store.client.close()
})

type Loose = Record<string, unknown> & { id: string }

const mapped = (change: (block: Loose) => Loose) => (doc: PaperDocument) =>
  ({
    ...doc,
    blocks: (structuredClone(doc.blocks) as unknown as Loose[]).map(change),
  }) as unknown as PaperDocument

describe("two tabs change one heading's type and level (review 7 H1)", () => {
  it("lets the type change win, drops the stale level, and keeps the typing elsewhere once with no failure", () =>
    h.inDatabase(async () => {
      const { docId, tab } = await newLetter(h, [
        {
          id: "h1",
          type: "heading",
          level: 2,
          content: [{ text: "Dear team" }],
        } as never,
        p("p1", "alpha one"),
        p("p2", "beta two"),
      ])
      const other = openTab(h, docId)
      await other.settle(2)
      tab.edit(
        mapped((block) =>
          block.id === "h1"
            ? { id: "h1", type: "paragraph", content: block.content }
            : block
        )
      )
      await tab.settle(2)
      other.edit(
        mapped((block) =>
          block.id === "h1"
            ? { ...block, level: 3 }
            : block.id === "p2"
              ? { ...block, content: [{ text: "beta two MINE" }] }
              : block
        )
      )
      await other.settle(3)
      await tab.settle(2)
      const { doc } = await serverDoc(h, docId)
      expect(flat(doc.blocks).map((block) => block.id)).toEqual([
        "h1",
        "p1",
        "p2",
      ])
      expect(flat(doc.blocks)[0]).toEqual({
        id: "h1",
        type: "paragraph",
        content: [{ text: "Dear team" }],
      })
      for (const word of ["Dear", "beta", "MINE"]) {
        expect(count(doc, word)).toBe(1)
      }
      expect(other.failures).toBe(0)
      expect(tab.failures).toBe(0)
      expect(other.doc().blocks).toEqual(doc.blocks)
      expect(tab.doc().blocks).toEqual(doc.blocks)
    }))
})
