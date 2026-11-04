import type { PaperDocument } from "@workspace/domain"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { openCoachStore, type CoachStore } from "../test/paper-coach.js"
import { clientFrom, withText } from "../test/paper-content.js"

const userId = "user-letter-start-save"
let h: CoachStore

beforeAll(async () => {
  h = await openCoachStore(userId)
})

afterAll(async () => {
  await h.store.client.close()
})

const draft = [
  { op: "setText", blockId: "letter-1", text: "Dear hiring team," },
  {
    op: "insert",
    after: "letter-1",
    blocks: [{ type: "paragraph", text: "I led the launch." }],
  },
]

function paragraphs(paper: unknown) {
  const blocks = (paper as { blocks?: unknown }).blocks
  if (!Array.isArray(blocks)) return []
  return blocks.flatMap((block) => {
    if (!block || typeof block !== "object") return []
    const row = block as { type?: string; content?: { text?: string }[] }
    if (row.type !== "paragraph") return []
    return [(row.content ?? []).map((part) => part.text ?? "").join("")]
  })
}

async function letter() {
  const created = await h.run("paper.create", {
    kind: "letter",
    name: "Cover letter",
  })
  const docId = (created.output as { id: string }).id
  const pulled = await h.run("paper.sync", {
    docId,
    epoch: 0,
    update: "",
    stateVector: "",
  })
  const client = clientFrom((pulled.output as { update: string }).update)
  return { docId, client }
}

describe("letter start save", () => {
  it("leaves each paragraph once when the same draft is saved again", async () => {
    await h.inDatabase(async () => {
      const { docId } = await letter()
      const first = await h.coach(docId, 1, draft)
      expect(first.output.outcomes.map((outcome) => outcome.status)).toEqual([
        "applied",
        "applied",
      ])
      const second = await h.coach(docId, 1, draft)
      expect(second.output.editId).toBeNull()
      expect(paragraphs(await h.paperOf(docId))).toEqual([
        "Dear hiring team,",
        "I led the launch.",
      ])
    })
  })

  it("keeps the person's words and does not copy the draft again", async () => {
    await h.inDatabase(async () => {
      const { docId, client } = await letter()
      await h.coach(docId, 1, draft)
      await h.person(docId, client, (paper) =>
        withText(paper, "letter-1", "Dear hiring team, kindly")
      )
      const again = await h.coach(docId, 1, draft)
      expect(again.output.editId).toBeNull()
      const lines = paragraphs(await h.paperOf(docId))
      expect(lines).toEqual(["Dear hiring team, kindly", "I led the launch."])
    })
  })

  it("does not replace a letter the person already wrote", async () => {
    await h.inDatabase(async () => {
      const { docId, client } = await letter()
      await h.person(docId, client, (paper: PaperDocument) =>
        withText(paper, "letter-1", "My own opening")
      )
      const save = await h.coach(docId, 1, draft)
      expect(save.output.editId).toBeNull()
      expect(paragraphs(await h.paperOf(docId))).toEqual(["My own opening"])
    })
  })
})
