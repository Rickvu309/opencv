import {
  queries,
  catalog,
  accountQueries as accountQueryContract,
  personActor,
} from "@workspace/domain"
import { eq } from "drizzle-orm"
import { describe, expect, it } from "vitest"

import { withDatabase } from "../db/context.js"
import { idempotency, user } from "../db/schema.js"
import { saveFile } from "../paper/index.js"
import { createMigratedTestDb } from "../test/harness.js"
import { installRegistry } from "../install.js"

const accountQueries = {
  ...accountQueryContract,
  "integrations.list": {
    output: catalog["integrations.list"].publicResult,
  },
  "billing.get": { output: catalog["billing.get"].publicResult },
  "coach.usage": { output: catalog["coach.usage"].publicResult },
  "activity.list": { output: catalog["activity.list"].publicResult },
}

const accountCommands = {
  "account.requestEmailChange": {
    output: catalog["account.requestEmailChange"].publicResult,
  },
  "account.delete": { output: catalog["account.delete"].publicResult },
  "notify.request": { output: catalog["notify.request"].publicResult },
  "profile.update": { output: catalog["profile.update"].publicResult },
  "profile.markWelcomed": {
    output: catalog["profile.markWelcomed"].publicResult,
  },
  "profile.setPhoto": { output: catalog["profile.setPhoto"].publicResult },
}

describe("an account binding that drifts from the account contract is rejected", () => {
  it("parses every account command output and every account read", async () => {
    const { db, client } = await createMigratedTestDb()
    const registry = installRegistry()
    const userId = "user-account-contract"
    await db.insert(user).values({
      id: userId,
      name: "Ada",
      email: "ada-account-contract@example.com",
    })
    const person = personActor(userId)

    await withDatabase(db, async () => {
      const seen = new Set<string>()
      const run = async (
        name: keyof typeof accountCommands,
        input: unknown
      ) => {
        const result = await registry.execute({ name, input, actor: person })
        const parsed = accountCommands[name].output.safeParse(result.output)
        expect(
          parsed.success,
          `${name}: ${JSON.stringify(parsed.error?.issues)}`
        ).toBe(true)
        seen.add(name)
        return result.output as Record<string, unknown>
      }
      const read = async (
        name: keyof typeof accountQueries,
        input: unknown
      ) => {
        const output = await registry.read(name, input, person)
        const parsed = accountQueries[name].output.safeParse(output)
        expect(
          parsed.success,
          `${name}: ${JSON.stringify(parsed.error?.issues)}`
        ).toBe(true)
        seen.add(name)
        return output
      }

      expect(await read("profile.get", {})).toMatchObject({ name: "Ada" })
      expect(await read("integrations.list", {})).toHaveProperty("groups")
      expect(await read("billing.get", {})).toMatchObject({ plan: "free" })
      expect(await read("coach.usage", {})).toMatchObject({ mode: "free" })

      expect(await run("profile.update", { name: "Ada L" })).toMatchObject({
        name: "Ada L",
      })
      await run("profile.markWelcomed", {})
      const file = await saveFile({
        userId: userId as never,
        name: "face.png",
        mediaType: "image/png",
        bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        purpose: "avatar",
      })
      expect(await run("profile.setPhoto", { fileId: file.id })).toMatchObject({
        image: file.id,
      })
      await run("account.requestEmailChange", { email: "next@example.com" })
      expect(await run("notify.request", { topic: "jobs" })).toMatchObject({
        topic: "jobs",
      })

      const feed = (await read("activity.list", {})) as unknown[]
      expect(Array.isArray(feed)).toBe(true)
      await read("activity.list", { subjectKind: "job", subjectId: "x" })

      await run("account.delete", { confirm: "DELETE" })

      expect([...seen].sort()).toEqual(
        [...Object.keys(accountCommands), ...Object.keys(accountQueries)].sort()
      )
    })
    await client.close()
  })

  it("keeps the Coach's read access to profile and usage only", () => {
    const registered = installRegistry().list().queries
    const coachReads = registered
      .filter((query) => query.coach)
      .map((query) => query.name)
    for (const name of Object.keys(accountQueryContract)) {
      expect(Object.keys(queries)).toContain(name)
    }
    expect(coachReads).toContain("profile.get")
    expect(coachReads).toContain("coach.usage")
    for (const name of ["integrations.list", "billing.get", "activity.list"]) {
      expect(coachReads).not.toContain(name)
    }
  })

  it("lets the Coach run only notify.request without asking", () => {
    const registered = installRegistry().list().commands
    const coachOnly = registered
      .filter((command) => command.name in accountCommands)
      .filter((command) => command.coach !== "never")
      .map((command) => command.name)
    expect(coachOnly).toEqual(["notify.request"])
  })

  it("deletes the account even when the caller sends an idempotency key", async () => {
    const { db, client } = await createMigratedTestDb()
    const registry = installRegistry()
    const userId = "user-delete-with-key"
    await db.insert(user).values({
      id: userId,
      name: "Ada",
      email: "ada-delete-key@example.com",
    })

    await withDatabase(db, async () => {
      for (const idempotencyKey of [undefined, "k-1"]) {
        const result = await registry.execute({
          name: "account.delete",
          input: { confirm: "DELETE" },
          actor: personActor(userId),
          idempotencyKey,
        })
        expect(result.output).toEqual({ deleted: true })
        expect(await db.select().from(user).where(eq(user.id, userId))).toEqual(
          []
        )
        expect(await db.select().from(idempotency)).toEqual([])
        await db.insert(user).values({
          id: userId,
          name: "Ada",
          email: "ada-delete-key@example.com",
        })
      }
    })
    await client.close()
  })
})
