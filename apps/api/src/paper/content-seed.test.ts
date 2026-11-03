import { emptyCvDocument, upgradeStoredPaper } from "@workspace/domain"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { withDatabase } from "../db/context.js"
import { paperDocs } from "../db/schema.js"
import { createId } from "../id.js"
import {
  clientFrom,
  openStore,
  twoParagraphCv,
  typed,
  withText,
} from "../test/paper-content.js"

type Store = Awaited<ReturnType<typeof openStore>>
type View = { id: string; contentVersion: number; paper: unknown }

let store: Store

beforeAll(async () => {
  store = await openStore("user-content-replace")
})

afterAll(async () => {
  await store.client.close()
})

async function run(name: string, input: unknown) {
  return store.registry.execute({ name, input, actor: store.actor })
}

async function reloaded(docId: string) {
  return (await store.registry.read(
    "paper.get",
    { docId },
    store.actor
  )) as View
}

async function insertRaw(kind: "cv" | "letter", document: unknown) {
  const id = createId()
  await store.db.insert(paperDocs).values({
    id,
    userId: store.actor.userId,
    name: "Raw",
    kind,
    document: document as Record<string, unknown>,
    contentVersion: 4,
  })
  return id
}

async function pulled(docId: string) {
  const reply = await run("paper.sync", {
    docId,
    epoch: 0,
    update: "",
    stateVector: "",
  })
  return (reply.output as { update: string }).update
}

describe("lazy seeding", () => {
  const letterWithParts = {
    markdown: "I am writing about the role.",
    sender: "Linh Nguyen",
    salutation: "Dear team,",
    signature: "Linh",
  }
  const v1Cv = {
    ...emptyCvDocument(),
    name: "Lan Nguyen",
    summary: "Ships small experiments.",
  }
  const cases: ["cv" | "letter", string, unknown, string][] = [
    ["cv", "version 1 CV", v1Cv, "Lan Nguyen"],
    ["cv", "version 2 CV", twoParagraphCv, "Second paragraph."],
    ["letter", "letter", letterWithParts, "Dear team,"],
  ]
  for (const [kind, label, stored, word] of cases) {
    it(`seeds a ${label} to the upgrade output and keeps its words`, async () => {
      await withDatabase(store.db, async () => {
        const id = await insertRaw(kind, stored)
        const client = clientFrom(await pulled(id))
        const row = (
          await store.db.select().from(paperDocs).where(eq(paperDocs.id, id))
        )[0]!
        const expected = upgradeStoredPaper(kind, stored)
        expect(expected.ok && row.crdtDocument).toEqual(
          expected.ok ? expected.document : null
        )
        expect([row.crdtEpoch, row.crdtBaseSeq, row.contentVersion]).toEqual([
          1, 4, 4,
        ])
        expect(row.document).toEqual(stored)

        const first = expected.ok
          ? expected.document.blocks.find((block) => "content" in block)
          : undefined
        const target = first?.id ?? "missing"
        const push = typed(client, (paper) =>
          withText(paper, target, "Edited start")
        )
        const reply = await run("paper.sync", {
          docId: id,
          epoch: 1,
          update: push,
          stateVector: "",
        })
        expect(reply.output).toMatchObject({ revision: 5 })
        const paper = (await reloaded(id)).paper
        expect(JSON.stringify(paper)).toContain("Edited start")
        expect(JSON.stringify(paper)).toContain(word)
      })
    })
  }
})
