import { personActor } from "@workspace/domain/kernel"
import { RICH_NATIVE_WRITER } from "@workspace/domain/paper-doc"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { getDb, withDatabase, type TestDatabase } from "../db/context.js"
import { paperDocs, user } from "../db/schema.js"
import type { Registry } from "../registry/registry.js"
import { createMigratedTestDb } from "../test/harness.js"
import { paperRegistry } from "./paper-registry.test-support.js"

const person = personActor("blank-paper-copy")
const writer = RICH_NATIVE_WRITER

let db: TestDatabase
let close: () => Promise<void>
let registry: Registry

beforeAll(async () => {
  const opened = await createMigratedTestDb()
  db = opened.db
  close = () => opened.client.close()
  await db.insert(user).values({
    id: person.userId,
    name: "Ada",
    email: "blank-paper-copy@example.com",
  })
  registry = paperRegistry()
})

afterAll(async () => {
  await close()
})

type Paper = { id: string; name: string }

async function storedDocument(docId: string) {
  const [row] = await getDb()
    .select({ document: paperDocs.snapshot })
    .from(paperDocs)
    .where(eq(paperDocs.id, docId))
  return row?.document
}

describe("A copy of a Paper that was started blank", () => {
  it("holds what the source held when it was copied", async () => {
    await withDatabase(db, async () => {
      const created = await registry.execute({
        name: "paper.create",
        input: { kind: "cv", name: "Marketing CV", lines: ["Việt Nam"] },
        actor: person,
      })
      const sourceId = (created.output as Paper).id
      const copied = await registry.execute({
        name: "paper.duplicate",
        input: { docId: sourceId, writer },
        actor: person,
      })
      const copy = copied.output as Paper
      expect(copy).toMatchObject({ name: "Copy of Marketing CV" })
      expect(copy.id).not.toBe(sourceId)
      expect(await storedDocument(copy.id)).toEqual(
        await storedDocument(sourceId)
      )
      expect(JSON.stringify(await storedDocument(copy.id))).toContain("Việt")
    })
  })
})
