import { personActor } from "@workspace/domain/kernel"
import { RICH_NATIVE_WRITER, paperPhotoRef } from "@workspace/domain/paper-doc"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { getDb, withDatabase, type TestDatabase } from "../db/context.js"
import { paperDocs, user } from "../db/schema.js"
import type { Registry } from "../registry/registry.js"
import { createMigratedTestDb } from "../test/harness.js"
import { richPaper } from "../test/rich-paper.js"
import { seedColumns } from "./content/content-document.js"
import { png } from "./photo.fixtures.js"
import { paperRegistry } from "./paper-registry.test-support.js"
import { saveFile } from "./store.js"

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

type Paper = { id: string; name: string; format?: string }

async function storedDocument(docId: string) {
  const [row] = await getDb()
    .select({ document: paperDocs.crdtDocument })
    .from(paperDocs)
    .where(eq(paperDocs.id, docId))
  return row?.document
}

describe("A copy of a Paper that was started blank", () => {
  it("holds what the source held when it was copied", async () => {
    await withDatabase(db, async () => {
      const created = await registry.execute({
        name: "paper.create",
        input: { kind: "cv", name: "Marketing CV", format: "rich" },
        actor: person,
      })
      const sourceId = (created.output as Paper).id
      const file = await saveFile({
        userId: person.userId,
        name: "face.png",
        mediaType: "image/png",
        bytes: Buffer.from(png),
        purpose: "avatar",
      })
      const written = richPaper("cv", paperPhotoRef(file.id))
      await getDb()
        .update(paperDocs)
        .set(seedColumns("cv", written))
        .where(eq(paperDocs.id, sourceId))
      const copied = await registry.execute({
        name: "paper.duplicate",
        input: { docId: sourceId, writer },
        actor: person,
      })
      const copy = copied.output as Paper
      expect(copy).toMatchObject({
        name: "Copy of Marketing CV",
        format: "rich",
      })
      expect(copy.id).not.toBe(sourceId)
      expect(await storedDocument(copy.id)).toEqual(
        await storedDocument(sourceId)
      )
      expect(JSON.stringify(await storedDocument(copy.id))).toContain("Việt")
    })
  })

  it("is refused for an editor that cannot open the source", async () => {
    await withDatabase(db, async () => {
      const created = await registry.execute({
        name: "paper.create",
        input: { kind: "letter", name: "Hello", format: "rich" },
        actor: person,
      })
      const sourceId = (created.output as Paper).id
      await expect(
        registry.execute({
          name: "paper.duplicate",
          input: { docId: sourceId },
          actor: person,
        })
      ).rejects.toThrow()
      const listed = (await registry.read(
        "paper.list",
        { writer },
        person
      )) as Paper[]
      expect(
        listed.filter((paper) => paper.name.startsWith("Copy of Hello"))
      ).toEqual([])
    })
  })
})
