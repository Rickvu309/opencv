import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import { describe, expect, it } from "vitest"

import type { LayoutPage } from "@workspace/domain/paper-doc"
import { createLayouter, paperFontMetrics } from "@workspace/paper-engine"

import {
  getDb,
  insideTransaction,
  transaction,
  withDatabase,
  type AppDatabase,
} from "../../db/context.js"
import { runMigrations } from "../../db/migrate.js"
import {
  createPaperLog,
  keepFirstPage,
  memoryLogStore,
  postgresLogStore,
  timeoutDebounce,
  writeFirstPage,
  type FirstPageSave,
} from "./index.js"
import { serverEngine, writer } from "./log.test-support.js"

const docId = "00000000-0000-4000-8000-000000002248"
const layouter = createLayouter(paperFontMetrics)

type Saved = { docId: string; page: LayoutPage; inside: boolean }

function collected(): { save: FirstPageSave; saved: Saved[] } {
  const saved: Saved[] = []
  return {
    saved,
    async save(id, page) {
      saved.push({ docId: id, page, inside: insideTransaction() })
    },
  }
}

function recordingSave(): { save: FirstPageSave; saved: Saved[] } {
  const inner = collected()
  return {
    saved: inner.saved,
    async save(id, page) {
      await inner.save(id, page)
      await writeFirstPage(id, page)
    },
  }
}

function plainJson(value: unknown) {
  return JSON.parse(JSON.stringify(value))
}

async function migratedClient() {
  const client = new PGlite()
  const db = drizzle({ client })
  await runMigrations(db as unknown as AppDatabase)
  return { client, db }
}

async function seedPaperDocsRow(client: PGlite, owner: string) {
  await client.exec(`
    insert into "opencv_app"."user" (id, name, email)
      values ('${owner}', 'Ada', '${owner}@example.com');
    insert into "opencv_app"."paper_docs" (id, user_id, name, kind, content_version)
      values ('${docId}', '${owner}', 'CV', 'cv', 0);
  `)
}

async function firstPageRow(client: PGlite) {
  const result = await client.query<{
    engine: number
    first_page: unknown
  }>(`select engine, first_page from "opencv_app"."paper_docs" where id = $1`, [
    docId,
  ])
  return result.rows[0]!
}

describe("the Paper log keeps the library card's first page", () => {
  it("stores the first page of the head document after each append, outside the write", async () => {
    const recorder = collected()
    const store = memoryLogStore()
    store.create(docId)
    const log = keepFirstPage(createPaperLog({ store, engine: serverEngine }), {
      debounce: () => {},
      layouter,
      save: recorder.save,
    })
    const tab = writer("first-page")
    await log.start(docId, tab.start)
    expect(recorder.saved).toEqual([])
    await log.flushFirstPage(docId)
    await log.append(docId, tab.type("Ada Lovelace", 0))
    await log.append(docId, tab.type(", engineer", 12))
    await log.flushFirstPage(docId)
    const head = await log.head(docId)
    expect("refusal" in head || "missing" in head).toBe(false)
    if ("refusal" in head || "missing" in head) return
    const expected = plainJson(layouter.layout(head.doc, null).pages[0]!)
    expect(recorder.saved).toHaveLength(2)
    expect(recorder.saved[1]!.docId).toBe(docId)
    expect(recorder.saved[1]!.inside).toBe(false)
    expect(recorder.saved[1]!.page).toEqual(expected)
  })

  it("schedules no page for a refused change or a Paper without a log", async () => {
    const scheduled: string[] = []
    const recorder = recordingSave()
    const store = memoryLogStore()
    store.create(docId)
    const log = keepFirstPage(createPaperLog({ store, engine: serverEngine }), {
      debounce: (id) => scheduled.push(id),
      layouter,
      save: recorder.save,
    })
    const tab = writer("refused")
    const refused = await log.append(docId, {
      ...tab.type("Ada", 0),
      base: 9,
    })
    expect("refusal" in refused).toBe(true)
    expect(scheduled).toEqual([])
    await log.flushFirstPage("00000000-0000-4000-8000-00000000dead")
    expect(recorder.saved).toEqual([])
  })

  it("writes the stored page on the Postgres store only for engine 2", async () => {
    const { client, db } = await migratedClient()
    await seedPaperDocsRow(client, "first-page-owner")
    const recorder = recordingSave()
    const log = keepFirstPage(
      createPaperLog({ store: postgresLogStore, engine: serverEngine }),
      { debounce: () => {}, layouter, save: recorder.save }
    )
    const tab = writer("postgres-first-page")
    await withDatabase(db, () => log.start(docId, tab.start))
    expect((await firstPageRow(client)).engine).toBe(2)
    await withDatabase(db, async () => {
      await log.append(docId, tab.type("Ada Lovelace", 0))
      await log.flushFirstPage(docId)
    })
    const head = await withDatabase(db, () => log.head(docId))
    expect("refusal" in head || "missing" in head).toBe(false)
    if ("refusal" in head || "missing" in head) return
    expect(await firstPageRow(client)).toMatchObject({
      engine: 2,
      first_page: plainJson(layouter.layout(head.doc, null).pages[0]!),
    })
    expect(recorder.saved).toHaveLength(1)
    expect(recorder.saved[0]!.inside).toBe(false)
  })

  it("leaves an engine 1 Paper's first page column alone", async () => {
    const { client, db } = await migratedClient()
    await seedPaperDocsRow(client, "old-owner")
    const recorder = recordingSave()
    const log = keepFirstPage(
      createPaperLog({ store: postgresLogStore, engine: serverEngine }),
      { debounce: () => {}, layouter, save: recorder.save }
    )
    await withDatabase(db, () => log.flushFirstPage(docId))
    expect((await firstPageRow(client)).first_page).toBe(null)
    expect(recorder.saved).toEqual([])
  })

  it("paints a page scheduled inside a save after that save has ended", async () => {
    const { db } = await migratedClient()
    const debounce = timeoutDebounce(0)
    const painted = await new Promise<{ inside: boolean; bound: boolean }>(
      (resolve, reject) => {
        withDatabase(db, () =>
          transaction(async () => {
            debounce(docId, async () => {
              try {
                const bound = getDb() !== undefined
                resolve({ inside: insideTransaction(), bound })
              } catch (error) {
                reject(error)
              }
            })
          })
        ).catch(reject)
      }
    )
    expect(painted).toEqual({ inside: false, bound: true })
  })
})
