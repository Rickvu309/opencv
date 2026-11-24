import { personActor } from "@workspace/domain"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { registerChat } from "../chat/index.js"
import { withDatabase, type TestDatabase } from "../db/context.js"
import { user } from "../db/schema.js"
import { Registry } from "../registry/registry.js"
import { createMigratedTestDb } from "../test/harness.js"
import { registerCoachTasks } from "./index.js"

const person = personActor("coach-alone")

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
    email: "coach-alone@example.com",
  })
  registry = new Registry()
  registerChat(registry)
  registerCoachTasks(registry)
})

afterAll(async () => {
  await close()
})

type Chat = { id: string; title: string }

describe("the Coach and its Chats with nothing else registered", () => {
  it("starts a Chat, renames it, lists it and has nothing to stop", async () => {
    await withDatabase(db, async () => {
      const created = await registry.execute({
        name: "chat.create",
        input: {},
        actor: person,
      })
      const chatId = (created.output as Chat).id
      await registry.execute({
        name: "chat.rename",
        input: { chatId, title: "Interview prep" },
        actor: person,
      })
      const listed = (await registry.read("chat.list", {}, person)) as Chat[]
      expect(listed.map((chat) => [chat.id, chat.title])).toEqual([
        [chatId, "Interview prep"],
      ])
      const stopped = await registry.execute({
        name: "coach.stop",
        input: { chatId },
        actor: person,
      })
      expect(stopped.output).toEqual({ stopped: false })
    })
  })

  it("registers only Coach, Chat and link preview operations", () => {
    const listed = registry.list()
    const names = [...listed.commands, ...listed.queries].map(
      (entry) => entry.name
    )
    expect(names.length).toBeGreaterThan(0)
    expect(names.filter((name) => !/^(chat|coach|link)\./.test(name))).toEqual(
      []
    )
  })
})
