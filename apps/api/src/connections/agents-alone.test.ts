import { personActor } from "@workspace/domain"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { withDatabase, type TestDatabase } from "../db/context.js"
import { user } from "../db/schema.js"
import { Registry } from "../registry/registry.js"
import { createMigratedTestDb } from "../test/harness.js"
import { registerConnections } from "./index.js"

const person = personActor("agents-alone")

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
    email: "agents-alone@example.com",
  })
  registry = new Registry()
  registerConnections(registry)
})

afterAll(async () => {
  await close()
})

describe("Agents with nothing else registered", () => {
  it("lists no agent connections for a person who has none", async () => {
    await withDatabase(db, async () => {
      expect(await registry.read("connections.list", {}, person)).toEqual([])
    })
  })

  it("registers only connection operations", () => {
    const listed = registry.list()
    const names = [...listed.commands, ...listed.queries].map(
      (entry) => entry.name
    )
    expect(names.length).toBeGreaterThan(0)
    expect(names.every((name) => name.startsWith("connections."))).toBe(true)
  })
})
