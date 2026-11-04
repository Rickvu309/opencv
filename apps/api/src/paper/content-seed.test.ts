import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { withDatabase } from "../db/context.js"
import { paperDocs } from "../db/schema.js"
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

async function pulled(docId: string) {
  const reply = await run("paper.sync", {
    docId,
    epoch: 0,
    update: "",
    stateVector: "",
  })
  return (reply.output as { update: string }).update
}

describe("a created v3 paper", () => {
  it("keeps the second paragraph after an edit", async () => {
    await withDatabase(store.db, async () => {
      const created = await run("paper.create", {
        kind: "cv",
        name: "Seeded",
        document: twoParagraphCv,
      })
      const id = (created.output as View).id
      const row = (
        await store.db.select().from(paperDocs).where(eq(paperDocs.id, id))
      )[0]!
      expect(row.crdtDocument).toEqual(twoParagraphCv)
      const client = clientFrom(await pulled(id))
      const push = typed(client, (paper) =>
        withText(paper, "t1", "Edited start")
      )
      const reply = await run("paper.sync", {
        docId: id,
        epoch: 1,
        update: push,
        stateVector: "",
      })
      expect(reply.output).toMatchObject({ revision: 2 })
      const text = JSON.stringify((await reloaded(id)).paper)
      expect(text).toContain("Edited start")
      expect(text).toContain("Second paragraph.")
    })
  })
})
