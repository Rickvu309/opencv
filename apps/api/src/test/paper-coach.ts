import type { CvPaper, PaperDocument } from "@workspace/domain"
import { absorbUpdate, stateVectorOf } from "@workspace/paper-crdt"
import { eq } from "drizzle-orm"
import { expect } from "vitest"

import { withDatabase } from "../db/context.js"
import { paperDocUpdates, paperDocs } from "../db/schema.js"
import {
  bytesOf,
  clientFrom,
  encoded,
  openStore,
  twoParagraphCv,
  typed,
} from "./paper-content.js"

export type EditOutput = {
  revision: number
  editId: string | null
  outcomes: { status: string; merged?: boolean }[]
}

export async function openCoachStore(userId: string) {
  const store = await openStore(userId)
  const inDatabase = <T>(run: () => Promise<T>) => withDatabase(store.db, run)

  async function run(name: string, input: unknown) {
    return store.registry.execute({ name, input, actor: store.actor })
  }

  async function created() {
    const paper = await run("paper.create", {
      kind: "cv",
      name: "Coach CV",
      document: twoParagraphCv,
    })
    const docId = (paper.output as { id: string }).id
    const pulled = await run("paper.sync", {
      docId,
      epoch: 0,
      update: "",
      stateVector: "",
    })
    const client = clientFrom((pulled.output as { update: string }).update)
    return { docId, client }
  }

  type Client = Awaited<ReturnType<typeof created>>["client"]

  async function pull(docId: string, client: Client) {
    const pulled = await run("paper.sync", {
      docId,
      epoch: 1,
      update: "",
      stateVector: encoded(stateVectorOf(client)),
    })
    absorbUpdate(
      client,
      bytesOf((pulled.output as { update: string }).update),
      "log"
    )
  }

  async function person(
    docId: string,
    client: Client,
    change: (paper: PaperDocument) => PaperDocument
  ) {
    await pull(docId, client)
    await run("paper.sync", {
      docId,
      epoch: 1,
      update: typed(client, change),
      stateVector: "",
    })
  }

  async function coach(docId: string, basedOn: number, edits: unknown[]) {
    const result = await run("paper.edit", { docId, basedOn, edits })
    return { ...result, output: result.output as EditOutput }
  }

  async function paperOf(docId: string) {
    const row = (
      await store.db.select().from(paperDocs).where(eq(paperDocs.id, docId))
    )[0]!
    return row.crdtDocument as unknown as CvPaper
  }

  async function textOf(docId: string, blockId: string) {
    const block = (await paperOf(docId)).blocks.find((b) => b.id === blockId)
    return block && "content" in block
      ? block.content.map((part) => part.text).join("")
      : null
  }

  async function rowCount(docId: string) {
    return (
      await store.db
        .select()
        .from(paperDocUpdates)
        .where(eq(paperDocUpdates.paperId, docId))
    ).length
  }

  async function dropCache(docId: string) {
    await expect(
      run("paper.sync", {
        docId,
        epoch: 1,
        update: Buffer.from([1, 2, 3]).toString("base64"),
        stateVector: "",
      })
    ).rejects.toBeDefined()
  }

  const experience = {
    op: "insert",
    after: "t2",
    blocks: [
      {
        type: "experience",
        role: "Analyst",
        company: "Babbage",
        period: "1842",
        bullets: [{ text: "Wrote the *first* program" }],
      },
    ],
  }

  return {
    store,
    inDatabase,
    run,
    created,
    pull,
    person,
    coach,
    paperOf,
    textOf,
    rowCount,
    dropCache,
    experience,
  }
}

export type CoachStore = Awaited<ReturnType<typeof openCoachStore>>
