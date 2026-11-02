import { ERROR_CODES, type CvBlockDocument } from "@workspace/domain"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { withDatabase } from "../db/context.js"
import { paperDocUpdates, paperDocs } from "../db/schema.js"
import {
  clientFrom,
  openStore,
  twoParagraphCv,
  typed,
} from "../test/paper-content.js"

type Store = Awaited<ReturnType<typeof openStore>>
type View = { id: string; contentVersion: number; document: unknown }

let store: Store

beforeAll(async () => {
  store = await openStore("user-content-undo")
})

afterAll(async () => {
  await store.client.close()
})

async function run(name: string, input: unknown) {
  return store.registry.execute({ name, input, actor: store.actor })
}

async function rowOf(docId: string) {
  return (
    await store.db.select().from(paperDocs).where(eq(paperDocs.id, docId))
  )[0]!
}

describe("undo of a replace", () => {
  it("restores the title, heading level and bold after ids changed", async () => {
    await withDatabase(store.db, async () => {
      const created = await run("paper.create", {
        kind: "cv",
        name: "CV",
        document: twoParagraphCv,
      })
      const docId = (created.output as View).id
      const pulled = await run("paper.sync", {
        docId,
        epoch: 0,
        update: "",
        stateVector: "",
      })
      const client = clientFrom((pulled.output as { update: string }).update)
      await run("paper.sync", {
        docId,
        epoch: 1,
        update: typed(
          client,
          (paper) =>
            ({
              ...paper,
              blocks: paper.blocks.map((block) => {
                if (block.id === "t1") {
                  return {
                    id: "t1",
                    type: "heading",
                    level: 3,
                    content: [{ text: "Lead", bold: true }],
                  }
                }
                return block.type === "section"
                  ? { ...block, title: "Profile" }
                  : block
              }),
            }) as never
        ),
        stateVector: "",
      })
      const before = (await rowOf(docId)).crdtDocument

      const seen = (await rowOf(docId)).document as CvBlockDocument
      const renumbered: CvBlockDocument = {
        ...seen,
        sections: seen.sections.map((section) => ({
          ...section,
          id: `new-${section.id}`,
          blocks: section.blocks.map((block) => ({
            ...block,
            id: `new-${block.id}`,
            ...(block.type === "heading" ? { text: "Lead dev" } : {}),
          })),
        })),
      }
      const saved = await run("paper.replace", {
        docId,
        contentVersion: (await rowOf(docId)).contentVersion,
        document: renumbered,
      })
      expect(JSON.stringify((await rowOf(docId)).crdtDocument)).toContain(
        "Lead dev"
      )

      const plan = saved.reversal!
      await run(plan.command, plan.input)
      expect((await rowOf(docId)).crdtDocument).toEqual(before)
    })
  })
})

describe("a retried save", () => {
  it("replays instead of conflicting when the stored legacy shape differs", async () => {
    await withDatabase(store.db, async () => {
      const listed: CvBlockDocument = {
        version: 2,
        header: { name: "Ada", email: "", phone: "", city: "", linkedin: "" },
        sections: [
          {
            id: "s1",
            kind: "summary",
            blocks: [
              {
                id: "l1",
                type: "bulleted-list",
                items: [
                  { id: "i1", text: "one" },
                  { id: "i2", text: "two" },
                ],
              },
            ],
          },
        ],
      }
      const created = await run("paper.create", {
        kind: "cv",
        name: "CV",
        document: listed,
      })
      const docId = (created.output as View).id
      const sent = { ...listed, header: { ...listed.header, name: "Ada L." } }
      await run("paper.replace", { docId, contentVersion: 1, document: sent })
      const stored = (await rowOf(docId)).document as CvBlockDocument
      const reshaped = {
        ...stored,
        sections: stored.sections.map((section) => ({
          ...section,
          blocks: section.blocks.map((block) => ({
            ...block,
            id: `${block.id}-list`,
          })),
        })),
      }
      await store.db
        .update(paperDocs)
        .set({ document: reshaped as unknown as Record<string, unknown> })
        .where(eq(paperDocs.id, docId))
      const retried = await run("paper.replace", {
        docId,
        contentVersion: 1,
        document: sent,
      })
      expect((retried.output as View).contentVersion).toBe(2)
      expect(
        (
          await store.db
            .select()
            .from(paperDocUpdates)
            .where(eq(paperDocUpdates.paperId, docId))
        ).length
      ).toBe(1)
      await expect(
        run("paper.replace", {
          docId,
          contentVersion: 1,
          document: { ...sent, header: { ...sent.header, name: "Other" } },
        })
      ).rejects.toMatchObject({ code: ERROR_CODES.CONFLICT })
    })
  })
})
