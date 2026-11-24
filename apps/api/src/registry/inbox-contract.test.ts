import {
  queries,
  inboxContract,
  inboxQueries,
  personActor,
} from "@workspace/domain"
import { describe, expect, it } from "vitest"

import { withDatabase } from "../db/context.js"
import { user } from "../db/schema.js"
import { createMigratedTestDb } from "../test/harness.js"
import { installRegistry } from "../install.js"

describe("an inbox binding that drifts from the inbox contract is rejected", () => {
  it("parses every inbox command output and inbox read", async () => {
    const { db, client } = await createMigratedTestDb()
    const registry = installRegistry()
    const userId = "user-inbox-contract"
    await db.insert(user).values({
      id: userId,
      name: "Ada",
      email: "ada-inbox-contract@example.com",
    })
    const person = personActor(userId)

    await withDatabase(db, async () => {
      const seen = new Set<string>()
      const run = async (name: keyof typeof inboxContract, input: unknown) => {
        const result = await registry.execute({ name, input, actor: person })
        const parsed = inboxContract[name].output.safeParse(result.output)
        expect(
          parsed.success,
          `${name}: ${JSON.stringify(parsed.error?.issues)}`
        ).toBe(true)
        seen.add(name)
        return result.output as Record<string, unknown>
      }
      const read = async (name: keyof typeof inboxQueries, input: unknown) => {
        const output = await registry.read(name, input, person)
        const parsed = inboxQueries[name].output.safeParse(output)
        expect(
          parsed.success,
          `${name}: ${JSON.stringify(parsed.error?.issues)}`
        ).toBe(true)
        seen.add(name)
        return output as Record<string, unknown>
      }

      await run("inbox.skip", {})
      await registry.execute({
        name: "job.create",
        input: {
          title: "Associate PM",
          company: "Local startup",
          stage: "applied",
        },
        actor: person,
      })
      const scanned = await run("inbox.scan", {})
      const threads = scanned.threads as { id: string; role: string }[]
      const idOfRole = (role: string) => {
        const found = threads.find((thread) => thread.role === role)
        if (!found) throw new Error(`missing ${role}`)
        return found.id
      }
      const analyst = idOfRole("Business Analyst")
      const startup = idOfRole("Associate PM")

      const listed = await read("inbox.list", {})
      expect(listed.threads).toHaveLength(6)
      expect((await read("inbox.snoozed", {})).threads).toEqual([])
      expect(await read("inbox.get", { threadId: analyst })).toMatchObject({
        id: analyst,
        role: "Business Analyst",
      })

      await run("inbox.markDone", { threadId: analyst })
      await run("inbox.snooze", {
        threadId: analyst,
        until: "2030-01-01T07:00:00.000Z",
      })
      expect((await read("inbox.snoozed", {})).threads).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: analyst })])
      )
      await run("inbox.draftReply", { threadId: analyst })
      await run("inbox.updateDraft", {
        threadId: analyst,
        body: "Thursday at 14:30 works.",
      })
      await run("inbox.addToCalendar", {
        threadId: analyst,
        start: "2026-10-29T07:30:00.000Z",
      })
      await run("inbox.send", { threadId: analyst })
      expect(await read("inbox.get", { threadId: analyst })).toMatchObject({
        draft: { body: "" },
        messages: expect.arrayContaining([
          expect.objectContaining({ direction: "out" }),
        ]),
      })

      const linked = await read("inbox.get", { threadId: startup })
      expect(linked).toMatchObject({
        suggestedStage: "interview",
        job: { title: "Associate PM" },
      })
      await run("inbox.acceptSuggestion", { threadId: startup })
      await run("inbox.clearSuggestion", { threadId: startup })

      expect([...seen].sort()).toEqual(
        [...Object.keys(inboxContract), ...Object.keys(inboxQueries)].sort()
      )
    })
    await client.close()
  })

  it("registers the inbox reads for the person only", () => {
    const registered = installRegistry().list().queries
    for (const name of Object.keys(inboxQueries)) {
      expect(Object.keys(queries)).toContain(name)
      expect(registered.find((query) => query.name === name)).toMatchObject({
        coach: false,
      })
    }
  })
})
