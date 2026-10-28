import {
  commands,
  jobContract,
  jobQueries,
  personActor,
  queries,
} from "@workspace/domain"
import { describe, expect, it } from "vitest"

import { withDatabase } from "../db/context.js"
import { user } from "../db/schema.js"
import { createMigratedTestDb } from "../test/harness.js"
import { idOf } from "./coverage-helpers.js"
import { installRegistry } from "./install.js"

describe("job contract", () => {
  it("parses every job command output and every job query read", async () => {
    const { db, client } = await createMigratedTestDb()
    const registry = installRegistry()
    const userId = "user-job-contract"
    await db.insert(user).values({
      id: userId,
      name: "Ada",
      email: "ada-job-contract@example.com",
    })
    const person = personActor(userId)

    await withDatabase(db, async () => {
      const seen = new Set<string>()
      const run = async (name: keyof typeof jobContract, input: unknown) => {
        const result = await registry.execute({ name, input, actor: person })
        const parsed = jobContract[name].output.safeParse(result.output)
        expect(
          parsed.success,
          `${name}: ${JSON.stringify(parsed.error?.issues)}`
        ).toBe(true)
        seen.add(name)
        return result.output
      }
      const read = async (name: keyof typeof jobQueries, input: unknown) => {
        const output = await registry.read(name, input, person)
        const parsed = jobQueries[name].output.safeParse(output)
        expect(
          parsed.success,
          `${name}: ${JSON.stringify(parsed.error?.issues)}`
        ).toBe(true)
        seen.add(name)
        return output
      }

      const created = await run("job.create", {
        title: "Intern",
        company: "Northwind",
        jobUrl: "https://example.com/jobs/1",
        deadline: "2030-01-02",
      })
      const jobId = idOf(created)
      const paper = await registry.execute({
        name: "paper.create",
        input: { kind: "cv", name: "Contract CV" },
        actor: person,
      })
      const docId = idOf(paper.output)

      await run("job.update", {
        jobId,
        patch: {
          location: "Hanoi",
          interviewAt: "2030-01-01T10:00:00.000Z",
          recruiterEmail: "r@example.com",
          posting: { about: "a", duties: "d", requirements: "r", details: "x" },
        },
      })
      await run("job.move", { jobId, stage: "applied" })
      await run("job.star", { jobId, starred: true })
      await run("job.addNote", { jobId, body: "Called them" })
      const item = await run("job.addChecklistItem", { jobId, label: "Read" })
      const itemId = idOf(item)
      await run("job.setChecklistItem", { jobId, itemId, done: true })
      await run("job.linkPaper", { jobId, docId, kind: "cv" })

      const detail = await read("job.get", { jobId })
      expect(detail).toMatchObject({
        note: "Called them",
        linked: { cv: { name: "Contract CV" }, letter: null },
      })
      await read("job.list", {})
      await read("job.list", { stage: "applied" })
      await read("job.calendar", {
        from: "2029-12-31T00:00:00.000Z",
        to: "2030-01-03T00:00:00.000Z",
      })
      await read("job.preview", { text: "" })
      await read("job.preview", { text: "Acme is hiring an Engineer in Oslo." })
      await read("job.preview", { text: "No structure here" })
      await read("job.preview", {
        url: "https://example.com/jobs/1",
        text: "Acme is hiring an Engineer in Oslo.",
      })

      await run("job.unlinkPaper", { jobId, kind: "cv" })
      await run("job.removeChecklistItem", { jobId, itemId })
      await run("job.delete", { jobId })

      expect([...seen].sort()).toEqual(
        [...Object.keys(jobContract), ...Object.keys(jobQueries)].sort()
      )
    })
    await client.close()
  })

  it("keeps the query table and the registry on the same names", () => {
    const registry = installRegistry()
    expect(
      registry
        .list()
        .queries.map((query) => query.name)
        .sort()
    ).toEqual(Object.keys(queries).sort())
  })

  it("keeps the contract policy and the registry on the same names", () => {
    const registry = installRegistry()
    const registered = new Map(
      registry.list().commands.map((command) => [command.name, command])
    )
    for (const [name, entry] of Object.entries(commands)) {
      expect(registered.get(name), name).toMatchObject({
        coach: entry.coach,
        destructive: entry.destructive,
      })
    }
  })
})
