import { ERROR_CODES, personActor } from "@workspace/domain/kernel"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { getDb, withDatabase, type TestDatabase } from "../db/context.js"
import { jobs, user } from "../db/schema.js"
import { bindOperation } from "../registry/bind.js"
import { Registry } from "../registry/registry.js"
import { createMigratedTestDb } from "../test/harness.js"
import { setPostingReader } from "./index.js"
import { implementation as createJob } from "./operations/create/server.js"
import { implementation as getJob } from "./operations/get/server.js"
import { implementation as previewJob } from "./operations/preview/server.js"
import { implementation as setPriority } from "./operations/set-priority/server.js"
import { implementation as updateJob } from "./operations/update/server.js"

const person = personActor("apply-rules")

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
    email: "apply-rules@example.com",
  })
  registry = new Registry()
  for (const binding of [createJob, getJob, setPriority, updateJob, previewJob])
    bindOperation(registry, binding as never)
})

afterAll(async () => {
  setPostingReader({ fetch: undefined, interpret: null })
  await close()
})

function inside<T>(work: () => Promise<T>) {
  return withDatabase(db, work)
}

async function priorityOf(jobId: string) {
  const [row] = await getDb()
    .select({ priority: jobs.priority, revision: jobs.priorityRevision })
    .from(jobs)
    .where(eq(jobs.id, jobId))
  return row
}

describe("a Job's priority has a version", () => {
  it("bumps on each real change, and a change against an old version changes nothing", async () => {
    await inside(async () => {
      const created = await registry.execute({
        name: "job.create",
        input: { title: "Intern", company: "Northwind" },
        actor: person,
      })
      const jobId = (created.output as { id: string }).id
      expect(await priorityOf(jobId)).toEqual({
        priority: "normal",
        revision: 0,
      })
      await registry.execute({
        name: "job.setPriority",
        input: { jobId, priority: "high" },
        actor: person,
      })
      expect(await priorityOf(jobId)).toEqual({ priority: "high", revision: 1 })
      await expect(
        registry.execute({
          name: "job.update",
          input: { jobId, patch: { location: "Hanoi", priority: "low" } },
          actor: person,
          expectedRevision: 0,
        })
      ).rejects.toMatchObject({ code: ERROR_CODES.CONFLICT })
      expect(await priorityOf(jobId)).toEqual({ priority: "high", revision: 1 })
    })
  })

  it("is recorded on every proposal that changes priority, through each command's basis", () => {
    expect(setPriority.basis).toEqual(expect.any(Function))
    expect(updateJob.basis).toEqual(expect.any(Function))
  })
})

describe("the posting reader is set once at install", () => {
  it("keeps the reader it has when installed again without one", async () => {
    setPostingReader({
      fetch: async () => ({
        ok: true,
        text: "Northwind is hiring an intern in Hanoi.",
      }),
    })
    setPostingReader()
    setPostingReader({ interpret: null })
    await inside(async () => {
      expect(
        await registry.read(
          "job.preview",
          { url: "https://careers.example.com/kept" },
          person
        )
      ).toMatchObject({ status: "filled", fields: { company: "Northwind" } })
    })
  })
})
