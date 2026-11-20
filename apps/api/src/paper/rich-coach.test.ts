import { randomUUID } from "node:crypto"
import {
  RICH_NATIVE_WRITER,
  nativeProvenance,
  parsePaperId,
  parseUserId,
  richReadOutputSchema,
  richReviewSchema,
  richTextNodes,
  prepareRichEdit,
} from "@workspace/domain"
import { openRichPaperClient } from "@workspace/paper-crdt"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { z } from "zod"
import { withDatabase } from "../db/context.js"
import { paperDocs, paperDocUpdates, user } from "../db/schema.js"
import { openStore } from "../test/paper-content.js"
import { seedCoachActor } from "../test/coach-turn.js"
import { resolveTurnGrounding, fakePaperIntent } from "../coach/index.js"
import { richElement, richText, richFragment } from "../test/rich-paper.js"
import { savedRichWord } from "./native-word.test-support.js"
import { syncContent } from "./content-store.js"

const owner = parseUserId("coach-rich-registry")
let store: Awaited<ReturnType<typeof openStore>>
let coach: Awaited<ReturnType<typeof seedCoachActor>>
beforeAll(async () => {
  store = await openStore(owner)
  await withDatabase(store.db, async () => {
    await store.db
      .update(user)
      .set({ agentCvs: true })
      .where(eq(user.id, owner))
    const chat = await store.registry.execute({
      name: "chat.create",
      input: {},
      actor: store.actor,
    })
    coach = await seedCoachActor(
      owner,
      z.object({ id: z.string() }).parse(chat.output).id
    )
  })
})
afterAll(async () => {
  await store.client.close()
})
const database = <T>(run: () => Promise<T>) => withDatabase(store.db, run)
async function snapshot(docId: string) {
  const [row] = await store.db
    .select()
    .from(paperDocs)
    .where(eq(paperDocs.id, docId))
  if (!row) throw new Error("Missing document")
  const log = await store.db
    .select()
    .from(paperDocUpdates)
    .where(eq(paperDocUpdates.paperId, docId))
  return {
    document: row.crdtDocument,
    revision: row.contentVersion,
    epoch: row.crdtEpoch,
    log,
  }
}
async function proposal(kind: "cv" | "letter") {
  const saved = await savedRichWord(store.db, owner, kind)
  const read = richReadOutputSchema.parse(
    await store.registry.read(
      "paper.readRich",
      { docId: saved.id, writer: RICH_NATIVE_WRITER, blockIds: ["intro"] },
      coach
    )
  )
  const outline = z
    .array(
      z.object({
        id: z.string(),
        selected: z.boolean(),
        content: z.array(z.unknown()),
      })
    )
    .parse(JSON.parse(read.outline))
  expect(outline.find((node) => node.id === "intro")?.selected).toBe(true)
  expect(outline.some((node) => node.id === "cell-text")).toBe(false)
  const words = richTextNodes(saved.document)
    .find((node) => node.id === "intro")
    ?.content.map((run) => run.text)
    .join("")
  if (!words) throw new Error("Missing introduction")
  const grounding = await resolveTurnGrounding({
    registry: store.registry,
    actor: coach,
    requestFocusDocId: saved.id,
    storedKind: null,
    storedId: null,
    memoryEnabled: false,
  })
  expect(grounding.focusDoc).toMatchObject({
    id: saved.id,
    outline: read.outline.replaceAll('"selected":true', '"selected":false'),
    nativeBasis: read.basis,
  })
  if (!grounding.focusDoc) throw new Error("Missing Coach document context")
  expect(fakePaperIntent(grounding.focusDoc)).toMatchObject({
    name: "paper.editRich",
    input: { docId: saved.id, basis: read.basis },
  })
  const input = {
    docId: saved.id,
    writer: RICH_NATIVE_WRITER,
    basis: read.basis,
    edits: [
      {
        op: "replaceText" as const,
        blockId: "intro",
        from: 0,
        to: 4,
        before: words.slice(0, 4),
        text: "Việt Nam",
      },
      {
        op: "formatText" as const,
        blockId: "intro",
        from: 0,
        to: 8,
        before: "Việt Nam",
        marks: { italic: true, underline: true },
      },
    ],
  }
  const before = await snapshot(saved.id)
  const pending = await store.registry.execute({
    name: "paper.editRich",
    input,
    actor: coach,
    idempotencyKey: randomUUID(),
  })
  expect(pending.pending).toBe(true)
  const pendingId = z.string().parse(pending.pendingActionId)
  const review = richReviewSchema.parse(pending.review)
  const plan = prepareRichEdit(saved.document, input.edits)
  expect(review.changes).toEqual(plan.changes)
  expect(review.changes[0]?.before).toEqual(
    richTextNodes(saved.document).find((node) => node.id === "intro")?.content
  )
  expect(await snapshot(saved.id)).toEqual(before)
  return { saved, pendingId, plan }
}
async function typeLater(
  saved: Awaited<ReturnType<typeof savedRichWord>>,
  blockId: string
) {
  const client = openRichPaperClient(null, {
    provenance: nativeProvenance(saved.document),
  })
  try {
    let sent = client.prepare()
    expect(
      client.receive(
        sent,
        await syncContent(owner, parsePaperId(saved.id), {
          ...sent,
          writer: RICH_NATIVE_WRITER,
        })
      ).failed
    ).toBe(false)
    richText(richElement(richFragment(client.ydoc), blockId)).insert(
      0,
      "Later writing "
    )
    const expected = client.document()
    if (!expected) throw new Error("Missing later document")
    sent = client.prepare()
    expect(
      client.receive(
        sent,
        await syncContent(owner, parsePaperId(saved.id), {
          ...sent,
          writer: RICH_NATIVE_WRITER,
        })
      ).failed
    ).toBe(false)
    return expected
  } finally {
    client.ydoc.destroy()
  }
}

describe.each(["cv", "letter"] as const)("rich %s Coach registry", (kind) => {
  it("reads, proposes, approves exactly once and undoes only its edit while retaining later writing", async () =>
    database(async () => {
      const { saved, pendingId, plan } = await proposal(kind)
      const receipt = await store.registry.approve(owner, pendingId)
      if (!receipt) throw new Error("Missing edit receipt")
      const approved = await snapshot(saved.id)
      expect(approved.document).toEqual(plan.document)
      expect(approved.epoch).toBe(1)
      expect(approved.log).toHaveLength(1)
      expect(await store.registry.approve(owner, pendingId)).toEqual(receipt)
      expect(await snapshot(saved.id)).toEqual(approved)
      const later = await typeLater(saved, "after")
      await store.registry.undo(owner, receipt.id)
      const expected = structuredClone(saved.document)
      const changed = richTextNodes(later).find((node) => node.id === "after")
      const target = richTextNodes(expected).find((node) => node.id === "after")
      if (!changed || !target) throw new Error("Missing later passage")
      target.content = changed.content
      expect((await snapshot(saved.id)).document).toEqual(expected)
    }))
  it("refuses stale approval without changing later writing", async () =>
    database(async () => {
      const { saved, pendingId } = await proposal(kind)
      await typeLater(saved, "after")
      const before = await snapshot(saved.id)
      await expect(store.registry.approve(owner, pendingId)).rejects.toThrow(
        /changed|stale|Basis conflict/i
      )
      expect(await snapshot(saved.id)).toEqual(before)
    }))
  it("clearly refuses Undo when the edited passage changed", async () =>
    database(async () => {
      const { saved, pendingId } = await proposal(kind)
      const receipt = await store.registry.approve(owner, pendingId)
      if (!receipt) throw new Error("Missing edit receipt")
      await typeLater(saved, "intro")
      const before = await snapshot(saved.id)
      await expect(store.registry.undo(owner, receipt.id)).rejects.toThrow(
        /later writing|passage changed/i
      )
      expect(await snapshot(saved.id)).toEqual(before)
    }))
  it("rejects tables and unsupported layout edits before creating a proposal", async () =>
    database(async () => {
      const saved = await savedRichWord(store.db, owner, kind)
      const before = await snapshot(saved.id)
      await expect(
        store.registry.execute({
          name: "paper.editRich",
          actor: coach,
          input: {
            docId: saved.id,
            writer: RICH_NATIVE_WRITER,
            basis: saved.basis,
            edits: [
              {
                op: "replaceText",
                blockId: "cell-text",
                from: 0,
                to: 4,
                before: "Việt",
                text: "Other",
              },
            ],
          },
        })
      ).rejects.toThrow(/tables|text passage/)
      await expect(
        store.registry.execute({
          name: "paper.editRich",
          actor: coach,
          input: {
            docId: saved.id,
            writer: RICH_NATIVE_WRITER,
            basis: saved.basis,
            edits: [{ op: "setPage", width: 100 }],
          },
        })
      ).rejects.toThrow()
      expect(await snapshot(saved.id)).toEqual(before)
    }))
})
