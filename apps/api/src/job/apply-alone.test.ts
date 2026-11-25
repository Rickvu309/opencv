import { personActor } from "@workspace/domain"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { withDatabase, type TestDatabase } from "../db/context.js"
import { user } from "../db/schema.js"
import { bindOperation } from "../registry/bind.js"
import { Registry } from "../registry/registry.js"
import { createMigratedTestDb } from "../test/harness.js"
import { registerJob } from "./index.js"
import { implementation as getJob } from "./operations/get/server.js"
import { implementation as listJobs } from "./operations/list/server.js"

type Job = { id: string; stage: string; starred: boolean }

const person = personActor("apply-alone")

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
    email: "apply-alone@example.com",
  })
  registry = new Registry()
  registerJob(registry)
  bindOperation(registry, listJobs)
  bindOperation(registry, getJob)
})

afterAll(async () => {
  await close()
})

function inside<T>(work: () => Promise<T>) {
  return withDatabase(db, work)
}

describe("Apply with nothing else registered", () => {
  it("registers only Job operations", () => {
    const listed = registry.list()
    const names = [...listed.commands, ...listed.queries].map(
      (entry) => entry.name
    )
    expect(names.length).toBeGreaterThan(0)
    expect(names.every((name) => name.startsWith("job."))).toBe(true)
  })

  it("saves, moves and lists a Job, and Undo moves it back", async () => {
    await inside(async () => {
      const created = await registry.execute({
        name: "job.create",
        input: { title: "Intern", company: "Northwind" },
        actor: person,
      })
      const jobId = (created.output as Job).id
      const moved = await registry.execute({
        name: "job.move",
        input: { jobId, stage: "applied" },
        actor: person,
      })
      expect((moved.output as Job).stage).toBe("applied")
      if (!moved.activityId) throw new Error("the move left no receipt")
      await registry.undo(person.userId, moved.activityId)
      const listed = (await registry.read("job.list", {}, person)) as Job[]
      expect(listed.map((job) => [job.id, job.stage])).toEqual([
        [jobId, "saved"],
      ])
    })
  })

  it("registers again on a second registry", () => {
    const second = new Registry()
    registerJob(second)
    registerJob(second)
    expect(second.list().commands.length).toBe(registry.list().commands.length)
  })
})
