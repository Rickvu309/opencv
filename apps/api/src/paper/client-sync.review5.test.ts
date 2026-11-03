import type { PaperDocument } from "@workspace/domain"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { openCoachStore, type CoachStore } from "../test/paper-coach.js"
import {
  count,
  li,
  newLetter,
  openTab,
  p,
  serverDoc,
  textOf,
} from "../test/paper-client.js"

let h: CoachStore

beforeAll(async () => {
  h = await openCoachStore("user-client-review5")
})

afterAll(async () => {
  await h.store.client.close()
})

const scenario = (name: string, run: () => Promise<void>) =>
  it(name, () => h.inDatabase(run))

const start = () =>
  newLetter(h, [
    p("p1", "alpha one"),
    p("p2", "beta two"),
    p("p3", "I write today."),
    li("l1", "parent words", [li("l2", "child")]),
    li("l3", "lone bullet"),
  ])

async function coach(docId: string, edit: Record<string, unknown>) {
  const { revision } = await serverDoc(h, docId)
  return h.coach(docId, revision, [edit])
}

type Loose = { id: string; type: string; content?: unknown; children?: Loose[] }

const mapBlocks = (doc: PaperDocument, change: (blocks: Loose[]) => Loose[]) =>
  ({
    ...doc,
    blocks: change(structuredClone(doc.blocks) as unknown as Loose[]),
  }) as unknown as PaperDocument

const asParagraph = (id: string, text?: string) => (doc: PaperDocument) =>
  mapBlocks(doc, (blocks) =>
    blocks.map((block) =>
      block.id === id
        ? {
            id,
            type: "paragraph",
            content: text === undefined ? block.content : [{ text }],
          }
        : block
    )
  )

const withContent = (id: string, text: string) => (doc: PaperDocument) =>
  mapBlocks(doc, (blocks) =>
    blocks.map((block) =>
      block.id === id ? { ...block, content: [{ text }] } : block
    )
  )

describe("review 5 probes on the editor's real Yjs shape", () => {
  scenario(
    "S1 a bullet turned into a paragraph in one tab keeps the typing from the other tab",
    async () => {
      const { docId, tab } = await start()
      const other = openTab(h, docId)
      await other.settle(2)
      tab.edit(asParagraph("l3"))
      await tab.settle(2)
      other.edit(withContent("l3", "lone bullet MINE"))
      await other.settle(3)
      await tab.settle(2)
      const { doc } = await serverDoc(h, docId)
      expect(count(doc, "MINE")).toBe(1)
      expect(other.failures).toBe(0)
      expect(tab.failures).toBe(0)
    }
  )

  scenario(
    "S2 a bullet turned into a paragraph keeps a Coach edit made before the push",
    async () => {
      const { docId, tab } = await start()
      tab.edit(asParagraph("l3"))
      await coach(docId, {
        op: "setText",
        blockId: "l3",
        text: "lone bullet COACH",
      })
      await tab.settle(3)
      const { doc } = await serverDoc(h, docId)
      expect(count(doc, "COACH")).toBe(1)
      expect(tab.failures).toBe(0)
    }
  )

  scenario(
    "S2b typing plus a type change keeps both the typing and the Coach edit",
    async () => {
      const { docId, tab } = await start()
      tab.edit(asParagraph("l3", "lone bullet TYPED"))
      await coach(docId, {
        op: "setText",
        blockId: "l3",
        text: "lone bullet COACH",
      })
      await tab.settle(3)
      const { doc } = await serverDoc(h, docId)
      expect(count(doc, "TYPED")).toBe(1)
      expect(count(doc, "COACH")).toBe(1)
      expect(tab.failures).toBe(0)
    }
  )

  scenario(
    "S3 a Backspace join while the Coach edits the joined paragraph keeps every word once",
    async () => {
      const { docId, tab } = await start()
      await coach(docId, {
        op: "setText",
        blockId: "p2",
        text: "beta two COACH",
      })
      tab.edit((doc) =>
        mapBlocks(doc, (blocks) =>
          blocks
            .filter((block) => block.id !== "p2")
            .map((block) =>
              block.id === "p1"
                ? { ...block, content: [{ text: "alpha onebeta two" }] }
                : block
            )
        )
      )
      await tab.settle(3)
      const { doc } = await serverDoc(h, docId)
      expect(count(doc, "beta")).toBe(1)
      expect(count(doc, "two")).toBe(1)
      expect(count(doc, "COACH")).toBe(1)
      expect(tab.failures).toBe(0)
    }
  )

  scenario(
    "S4 two sentences appended to one paragraph stay whole and in order",
    async () => {
      const { docId, tab } = await start()
      await coach(docId, {
        op: "setText",
        blockId: "p3",
        text: "I write today. I want to join the team.",
      })
      tab.edit(withContent("p3", "I write today. I hope to meet the founders."))
      await tab.settle(3)
      const { doc } = await serverDoc(h, docId)
      const text = textOf(doc, "p3") ?? ""
      expect(text).toContain("I want to join the team.")
      expect(text).toContain("I hope to meet the founders.")
      expect(text.startsWith("I write today.")).toBe(true)
    }
  )

  scenario(
    "S5 the Coach merging two paragraphs while the person types in the second keeps the typing once",
    async () => {
      const { docId, tab } = await start()
      tab.edit(withContent("p2", "beta two TYPED"))
      const { revision } = await serverDoc(h, docId)
      await h.coach(docId, revision, [
        { op: "setText", blockId: "p1", text: "alpha one beta two" },
        { op: "remove", blockId: "p2" },
      ])
      await tab.settle(3)
      const { doc } = await serverDoc(h, docId)
      expect(count(doc, "TYPED")).toBe(1)
      expect(count(doc, "beta")).toBe(1)
      expect(tab.failures).toBe(0)
    }
  )
})
