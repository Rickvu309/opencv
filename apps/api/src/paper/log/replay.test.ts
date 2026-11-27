import { PGlite } from "@electric-sql/pglite"
import type { Change, Document } from "@workspace/domain/paper-doc"
import { createEngine, fixedClock, seededIds } from "@workspace/paper-engine"
import { drizzle } from "drizzle-orm/pglite"
import { describe, expect, it } from "vitest"

import type { AppDatabase } from "../../db/context.js"
import { withDatabase } from "../../db/context.js"
import { runMigrations } from "../../db/migrate.js"
import {
  createPaperLog,
  memoryLogStore,
  postgresLogStore,
  type PaperLogStore,
} from "./index.js"
import { serverEngine } from "./log.test-support.js"
import fixture from "./replay.fixture.json" with { type: "json" }

const docId = "00000000-0000-4000-8000-000000002230"
const start = fixture.start as unknown as Document
const changes = fixture.changes as unknown as Change[]
const expected = JSON.stringify(fixture.snapshot)

async function postgresStore(): Promise<PaperLogStore> {
  const client = new PGlite()
  const db = drizzle({ client })
  await runMigrations(db as unknown as AppDatabase)
  await client.exec(`
    insert into "opencv_app"."user" (id, name, email)
      values ('replay-owner', 'Ada', 'replay-owner@example.com');
    insert into "opencv_app"."files"
      (id, user_id, name, media_type, byte_size, purpose, bytes)
      values ('00000000-0000-4000-8000-0000000000f2', 'replay-owner', 'face.png', 'image/png', 1, 'avatar', '\\x89');
    insert into "opencv_app"."paper_docs" (id, user_id, name, kind, content_version)
      values ('${docId}', 'replay-owner', 'CV', 'cv', 0);
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

describe.each([
  ["memory", memoryStore],
  ["postgres", postgresStore],
] as const)("replaying the fixture log on the %s store", (_name, makeStore) => {
  async function replayed() {
    const log = createPaperLog({
      store: await makeStore(),
      engine: serverEngine,
    })
    await log.start(docId, start)
    for (const change of changes)
      expect(await log.append(docId, change)).toMatchObject({ ok: true })
    return log
  }

  it("gives the same snapshot JSON byte for byte", async () => {
    const log = await replayed()
    const head = await log.head(docId)
    expect("doc" in head! && JSON.stringify(head.doc)).toBe(expected)
    expect(head).toMatchObject({ version: changes.length })
  })

  it("gives the same bytes from a snapshot taken partway", async () => {
    const log = await replayed()
    expect(await log.compact(docId, 6)).toEqual({ ok: true, through: 6 })
    const head = await log.head(docId)
    expect("doc" in head! && JSON.stringify(head.doc)).toBe(expected)
  })

  it("gives a fresh tab the same bytes from the changes it pulls", async () => {
    const log = await replayed()
    const pulled = await log.since(docId, 0)
    const engine = createEngine({ ids: seededIds("tab-2"), now: fixedClock() })
    const tab = engine.receive(
      engine.load(start, 0, "tab-2"),
      "changes" in pulled! ? pulled.changes : []
    ).state
    expect(JSON.stringify(engine.read(tab).doc)).toBe(expected)
  })
})
