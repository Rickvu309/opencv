import { PGlite } from "@electric-sql/pglite"
import type { Change } from "@workspace/domain/paper-doc"
import { drizzle } from "drizzle-orm/pglite"
import { describe, expect, it } from "vitest"

import type { AppDatabase } from "../../db/context.js"
import { withDatabase } from "../../db/context.js"
import { runMigrations } from "../../db/migrate.js"
import {
  createPaperLog,
  MAX_STEPS_PER_CHANGE,
  memoryLogStore,
  postgresLogStore,
  type PaperLogStore,
} from "./index.js"
import { serverEngine, writer } from "./log.test-support.js"

const docId = "00000000-0000-4000-8000-000000002229"

async function postgresStore(): Promise<PaperLogStore> {
  const client = new PGlite()
  const db = drizzle({ client })
  await runMigrations(db as unknown as AppDatabase)
  await client.exec(`
    insert into "opencv_app"."user" (id, name, email)
      values ('hostile-owner', 'Ada', 'hostile-owner@example.com');
    insert into "opencv_app"."paper_docs" (id, user_id, name, kind, content_version)
      values ('${docId}', 'hostile-owner', 'CV', 'cv', 0);
  `)
  return {
    open: (id, mode, work) =>
      withDatabase(db, () => postgresLogStore.open(id, mode, work)),
  }
}

function memoryStore(): PaperLogStore {
  const store = memoryLogStore()
  store.create(docId)
  return store
}

function edited(change: Change, edit: (json: string) => string): Change {
  return JSON.parse(edit(JSON.stringify(change))) as Change
}

describe.each([
  ["memory", memoryStore],
  ["postgres", postgresStore],
] as const)("hostile changes on the %s store", (_name, makeStore) => {
  async function seeded() {
    const log = createPaperLog({
      store: await makeStore(),
      engine: serverEngine,
    })
    const tab = writer()
    await log.start(docId, tab.start)
    const kept = tab.type("Kept", 0)
    await log.append(docId, kept)
    const before = JSON.stringify(await log.head(docId))
    async function nothingStored() {
      expect(JSON.stringify(await log.head(docId))).toBe(before)
      const since = await log.since(docId, 0)
      expect("changes" in since! && since.changes.map((c) => c.edit)).toEqual([
        kept.edit,
      ])
    }
    return { log, tab, kept, nothingStored }
  }

  it("refuses an oversized change and stores nothing", async () => {
    const { log, tab, nothingStored } = await seeded()
    const huge = tab.type("x".repeat(600 * 1024), 4)
    expect(await log.append(docId, huge)).toEqual({
      refusal: { code: "too-large", limit: "512 KiB per change" },
    })
    const many = {
      ...huge,
      steps: Array.from(
        { length: MAX_STEPS_PER_CHANGE + 1 },
        () => huge.steps[0]!
      ),
    }
    expect(await log.append(docId, many)).toEqual({
      refusal: {
        code: "too-large",
        limit: `${MAX_STEPS_PER_CHANGE} steps per change`,
      },
    })
    await nothingStored()
  })

  it("refuses schema-breaking steps and stores nothing", async () => {
    const { log, tab, nothingStored } = await seeded()
    const split = tab.run([
      { op: "splitBlock", at: { block: "paragraph-1", offset: 2 } as never },
    ])
    const sameId = edited(split, (json) =>
      json.replaceAll(/"id":"edit-\d+"/g, '"id":"paragraph-1"')
    )
    expect(await log.append(docId, { ...sameId, base: 1 })).toMatchObject({
      refusal: { code: "schema" },
    })
    const unknownNode = edited(split, (json) =>
      json.replaceAll('"text_block"', '"script"')
    )
    expect(await log.append(docId, { ...unknownNode, base: 1 })).toMatchObject({
      refusal: { code: "schema" },
    })
    const notAStep = {
      ...split,
      base: 1,
      steps: [{ stepType: "replace", from: "nowhere" }],
    }
    expect(await log.append(docId, notAStep)).toMatchObject({
      refusal: { code: "schema" },
    })
    expect(
      await log.append(docId, { ...split, base: 1, origin: { kind: "root" } })
    ).toMatchObject({
      refusal: { code: "schema" },
    })
    expect(
      await log.append(docId, { ...split, base: 1, steps: [] })
    ).toMatchObject({
      refusal: { code: "schema" },
    })
    await nothingStored()
  })

  it("refuses a reused edit id carrying other steps and stores nothing", async () => {
    const { log, tab, kept, nothingStored } = await seeded()
    const other = tab.type("Other", 4)
    expect(
      await log.append(docId, { ...other, edit: kept.edit, base: 1 })
    ).toMatchObject({
      refusal: {
        code: "schema",
        detail: `Edit ${kept.edit} was already saved with other steps`,
      },
    })
    await nothingStored()
  })

  it("refuses out-of-range steps and stores nothing", async () => {
    const { log, tab, nothingStored } = await seeded()
    const typed = tab.type("!", 4)
    const far = edited(typed, (json) =>
      json.replace(/"from":\d+,"to":\d+/, '"from":99999,"to":99999')
    )
    expect(await log.append(docId, far)).toMatchObject({
      refusal: { code: "schema" },
    })
    const negative = edited(typed, (json) =>
      json.replace(/"from":\d+,"to":\d+/, '"from":-3,"to":-3')
    )
    expect(await log.append(docId, negative)).toMatchObject({
      refusal: { code: "schema" },
    })
    expect(await log.since(docId, 99)).toEqual({
      refusal: { code: "stale", head: 1 },
    })
    expect(await log.compact(docId, 99)).toEqual({
      refusal: { code: "stale", head: 1 },
    })
    await nothingStored()
  })

  it("keeps the inverse the server computed, not the one the client sent", async () => {
    const { log, tab, kept } = await seeded()
    const typed = tab.type("!", 4)
    const forged = { ...typed, inverse: kept.inverse }
    expect(await log.append(docId, forged)).toMatchObject({ ok: true })
    const since = await log.since(docId, 1)
    expect(
      JSON.stringify("changes" in since! && since.changes[0]!.inverse)
    ).not.toBe(JSON.stringify(kept.inverse))
  })
})
