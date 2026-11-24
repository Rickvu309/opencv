import { personActor } from "@workspace/domain"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { withDatabase, type TestDatabase } from "../db/context.js"
import { user } from "../db/schema.js"
import { bindOperation } from "../registry/bind.js"
import { Registry } from "../registry/registry.js"
import { implementation as deleteAccount } from "./operations/account/delete/server.js"
import { implementation as requestEmailChange } from "./operations/account/request-email-change/server.js"
import { implementation as notify } from "./operations/notify/request/server.js"
import { implementation as markWelcomed } from "./operations/profile/mark-welcomed/server.js"
import { implementation as setPhoto } from "./operations/profile/set-photo/server.js"
import { implementation as update } from "./operations/profile/update/server.js"
import { createMigratedTestDb } from "../test/harness.js"
import { hostEmailChangeCode, registerAccountQueries } from "./index.js"

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
  bindOperation(registry, requestEmailChange)
  bindOperation(registry, deleteAccount)
  bindOperation(registry, notify)
  registerAccountQueries(registry)
  bindOperation(registry, update)
  bindOperation(registry, markWelcomed)
  bindOperation(registry, setPhoto)
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
})
