import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import { describe, expect, it } from "vitest"

import type { AppDatabase } from "../../db/context.js"
import { withDatabase } from "../../db/context.js"
import { runMigrations } from "../../db/migrate.js"
import {
  createPaperLog,
  memoryLogStore,
  photoReferences,
  postgresLogStore,
  SNAPSHOT_EVERY,
  type PaperLogStore,
} from "./index.js"
import { person, serverEngine, writer } from "./log.test-support.js"

const docId = "00000000-0000-4000-8000-000000002228"
const photo = "00000000-0000-4000-8000-0000000000f1"

async function postgresDatabase() {
  const client = new PGlite()
  const db = drizzle({ client })
  await runMigrations(db as unknown as AppDatabase)
  await client.exec(`
    insert into "opencv_app"."user" (id, name, email)
      values ('log-owner', 'Ada', 'log-owner@example.com');
    insert into "opencv_app"."files"
      (id, user_id, name, media_type, byte_size, purpose, bytes)
      values ('${photo}', 'log-owner', 'face.png', 'image/png', 1, 'avatar', '\\x89');
    insert into "opencv_app"."paper_docs" (id, user_id, name, kind, content_version)
      values ('${docId}', 'log-owner', 'CV', 'cv', 0);
  `)
  const store: PaperLogStore = {
    open: (id, mode, work) =>
      withDatabase(db, () => postgresLogStore.open(id, mode, work)),
  }
  return { client, store }
}

async function postgresStore(): Promise<PaperLogStore> {
  return (await postgresDatabase()).store
}

function memoryStore(): PaperLogStore {
  const store = memoryLogStore()
  store.create(docId)
  return store
}

describe.each([
  ["memory", memoryStore],
  ["postgres", postgresStore],
] as const)("the Paper log on the %s store", (_name, makeStore) => {
  async function started() {
    const log = createPaperLog({
      store: await makeStore(),
      engine: serverEngine,
    })
    const tab = writer()
    expect(await log.start(docId, tab.start)).toEqual({ ok: true })
    return { log, tab }
  }

  it("reads back a Paper saved through the log exactly as the tab sees it", async () => {
    const { log, tab } = await started()
    const first = tab.type("Ada Lovelace", 0)
    expect(await log.append(docId, first)).toMatchObject({
      ok: true,
      head: 1,
      duplicate: false,
    })
    const second = tab.type(", engineer", 12)
    const saved = await log.append(docId, second)
    expect(saved).toMatchObject({ ok: true, duplicate: false })
    const head = await log.head(docId)
    expect(JSON.stringify(head)).toBe(
      JSON.stringify({
        doc: tab.doc(),
        version: first.steps.length + second.steps.length,
      })
    )
  })

  it("stores an edit sent twice once and answers the same head", async () => {
    const { log, tab } = await started()
    const change = tab.type("Once", 0)
    const first = await log.append(docId, change)
    const again = await log.append(docId, change)
    expect(again).toEqual({ ...first, duplicate: true })
    const since = await log.since(docId, 0)
    expect(since).toMatchObject({ head: 1 })
    expect("changes" in since! && since.changes.map((c) => c.edit)).toEqual([
      change.edit,
    ])
  })

  it("refuses an edit made on an older version and stores nothing", async () => {
    const { log, tab } = await started()
    await log.append(docId, tab.type("A", 0))
    const late = { ...tab.type("B", 1), base: 0 }
    expect(await log.append(docId, late)).toEqual({
      refusal: { code: "stale", head: 1 },
    })
    expect(await log.head(docId)).toMatchObject({ version: 1 })
  })

  it("lists the changes since a version in order and refuses a version inside a change", async () => {
    const { log, tab } = await started()
    const changes = [tab.type("a", 0), tab.type("b", 1), tab.type("c", 2)]
    for (const change of changes) await log.append(docId, change)
    const since = await log.since(docId, 1)
    expect("changes" in since! && since.changes.map((c) => c.edit)).toEqual(
      changes.slice(1).map((c) => c.edit)
    )
    expect(await log.since(docId, 9)).toEqual({
      refusal: { code: "stale", head: 3 },
    })
  })

  it("writes a snapshot every 200 versions and keeps reading the same document", async () => {
    const { log, tab } = await started()
    for (let index = 0; index < SNAPSHOT_EVERY + 5; index += 1)
      await log.append(docId, tab.type("x", index))
    const head = await log.head(docId)
    expect(head).toMatchObject({ version: SNAPSHOT_EVERY + 5 })
    expect(JSON.stringify("doc" in head! && head.doc)).toBe(
      JSON.stringify(tab.doc())
    )
  })

  it("compacts old changes and sends a reader behind them the whole document", async () => {
    const { log, tab } = await started()
    for (const [index, text] of ["a", "b", "c", "d"].entries())
      await log.append(docId, tab.type(text, index))
    expect(await log.compact(docId, 2)).toEqual({ ok: true, through: 2 })
    expect(await log.since(docId, 0)).toEqual({
      compacted: { doc: tab.doc(), version: 4, head: 4 },
    })
    const since = await log.since(docId, 2)
    expect("changes" in since! && since.changes).toHaveLength(2)
    expect(JSON.stringify(await log.head(docId))).toBe(
      JSON.stringify({ doc: tab.doc(), version: 4 })
    )
  })

  it("reverts an earlier change past a later one", async () => {
    const { log, tab } = await started()
    const hello = tab.type("Hello", 0)
    await log.append(docId, hello)
    await log.append(docId, tab.type(" world", 5))
    const reverted = await log.revert(docId, hello.edit, {
      edit: "revert-1",
      origin: { ...person, kind: "system" },
    })
    expect(reverted).toMatchObject({ ok: true, duplicate: false })
    const head = await log.head(docId)
    const text = JSON.stringify("doc" in head! && head.doc.content[0])
    expect(text).toContain(" world")
    expect(text).not.toContain("Hello")
  })

  it("records the photos a change lets go of", async () => {
    const { log, tab } = await started()
    const added = tab.run([
      {
        op: "insertImage",
        at: { block: "paragraph-1", offset: 0 } as never,
        fileId: photo as never,
        widthMpt: 72000,
        heightMpt: 72000,
      },
    ])
    expect(await log.append(docId, added)).toMatchObject({ released: [] })
    expect(photoReferences(tab.doc())).toEqual([photo])
    const removed = await log.revert(docId, added.edit, {
      edit: "drop-photo",
      origin: { ...person, kind: "system" },
    })
    expect(removed).toMatchObject({ ok: true, released: [photo] })
  })
})

describe("photo references held by the Paper log on Postgres", () => {
  async function sources(client: PGlite) {
    const rows = await client.query<{ source: string }>(
      `select source from "opencv_app"."photo_refs" where file_id = '${photo}' order by source`
    )
    return rows.rows.map((row) => row.source.split(":")[0])
  }

  it("keeps a photo referenced while a change, its inverse or the snapshot holds it", async () => {
    const { client, store } = await postgresDatabase()
    const log = createPaperLog({ store, engine: serverEngine })
    const tab = writer()
    expect(await log.start(docId, tab.start)).toEqual({ ok: true })
    const added = tab.run([
      {
        op: "insertImage",
        at: { block: "paragraph-1", offset: 0 } as never,
        fileId: photo as never,
        widthMpt: 72000,
        heightMpt: 72000,
      },
    ])
    const appended = await log.append(docId, added)
    expect(appended).toMatchObject({ ok: true })
    expect(await sources(client)).toEqual([
      "paper_changes.commands",
      "paper_changes.steps",
    ])
    const kept = await log.revert(docId, added.edit, {
      edit: "drop-photo",
      origin: { ...person, kind: "system" },
    })
    expect(kept).toMatchObject({ ok: true, released: [photo] })
    const head = (await log.head(docId)) as { version: number }
    expect(await log.compact(docId, added.steps.length)).toMatchObject({
      ok: true,
    })
    expect(await sources(client)).toEqual([
      "paper_changes.inverse",
      "paper_docs.snapshot",
    ])
    expect(await log.compact(docId, head.version)).toMatchObject({ ok: true })
    expect(await sources(client)).toEqual([])
  })
})
