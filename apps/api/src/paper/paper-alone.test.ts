import { personActor } from "@workspace/domain/kernel"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { withDatabase, type TestDatabase } from "../db/context.js"
import { user } from "../db/schema.js"
import type { Registry } from "../registry/registry.js"
import { createMigratedTestDb } from "../test/harness.js"
import { paperRegistry } from "./paper-registry.test-support.js"

const person = personActor("paper-alone")

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
    email: "paper-alone@example.com",
  })
  registry = paperRegistry()
})

afterAll(async () => {
  await close()
})

type Paper = { id: string; name: string }

describe("Paper with nothing else registered", () => {
  it("starts a blank Paper, lists it, renames it and deletes it", async () => {
    await withDatabase(db, async () => {
      const created = await registry.execute({
        name: "paper.create",
        input: { kind: "cv", name: "Marketing CV", format: "rich" },
        actor: person,
      })
      const docId = (created.output as Paper).id
      await registry.execute({
        name: "paper.update",
        input: { docId, patch: { name: "Product CV" } },
        actor: person,
      })
      const listed = (await registry.read("paper.list", {}, person)) as Paper[]
      expect(listed.map((paper) => [paper.id, paper.name])).toEqual([
        [docId, "Product CV"],
      ])
      await registry.execute({
        name: "paper.delete",
        input: { docId },
        actor: person,
      })
      expect(await registry.read("paper.list", {}, person)).toEqual([])
    })
  })

  it("registers only Paper and file operations", () => {
    const listed = registry.list()
    const names = [...listed.commands, ...listed.queries].map(
      (entry) => entry.name
    )
    expect(names.length).toBeGreaterThan(0)
    expect(names.filter((name) => !/^(paper|file)\./.test(name))).toEqual([])
  })
})
