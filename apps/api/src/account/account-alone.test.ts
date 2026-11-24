import { personActor } from "@workspace/domain"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { withDatabase, type TestDatabase } from "../db/context.js"
import { user } from "../db/schema.js"
import { Registry } from "../registry/registry.js"
import { createMigratedTestDb } from "../test/harness.js"
import {
  hostEmailChangeCode,
  registerAccount,
  registerAccountQueries,
} from "./index.js"

const person = personActor("account-alone")

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
    email: "account-alone@example.com",
  })
  registry = new Registry()
  registerAccount(registry)
  registerAccountQueries(registry)
})

afterAll(async () => {
  await close()
})

describe("Account with nothing else registered", () => {
  it("reads and changes the person's profile", async () => {
    await withDatabase(db, async () => {
      await registry.execute({
        name: "profile.update",
        input: { startPage: "paper" },
        actor: person,
      })
      expect(await registry.read("profile.get", {}, person)).toMatchObject({
        name: "Ada",
        plan: "free",
        startPage: "paper",
      })
    })
  })

  it("keeps one notify request per topic", async () => {
    await withDatabase(db, async () => {
      const ask = () =>
        registry.execute({
          name: "notify.request",
          input: { topic: "pitch" },
          actor: person,
        })
      const first = (await ask()).output as { id: string }
      const again = (await ask()).output as { id: string }
      expect(again.id).toBe(first.id)
    })
  })

  it("sends an email change code only through the sender it is handed", async () => {
    const change = () =>
      registry.execute({
        name: "account.requestEmailChange",
        input: { email: "next@example.com" },
        actor: person,
      })
    await withDatabase(db, async () => {
      expect((await change()).output).toMatchObject({ sent: false })
      const asked: string[] = []
      hostEmailChangeCode(async (email) => {
        asked.push(email)
        return "sent"
      })
      expect((await change()).output).toMatchObject({
        email: "next@example.com",
        sent: true,
      })
      expect(asked).toEqual(["next@example.com"])
      hostEmailChangeCode(async () => "refused")
      await expect(change()).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
      })
      hostEmailChangeCode(async () => {
        throw new Error("Email is the same")
      })
      await expect(change()).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
      })
    })
  })

  it("registers again on a second registry", () => {
    const second = new Registry()
    registerAccount(second)
    registerAccount(second)
    expect(second.list().commands.length).toBe(registry.list().commands.length)
  })
})
