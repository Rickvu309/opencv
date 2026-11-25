import { personActor } from "@workspace/domain"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { withDatabase, type TestDatabase } from "../db/context.js"
import { user } from "../db/schema.js"
import { bindOperation } from "../registry/bind.js"
import { Registry } from "../registry/registry.js"
import { createMigratedTestDb } from "../test/harness.js"
import { registerInbox } from "./index.js"
import { implementation as acceptSuggestion } from "./operations/accept-suggestion/server.js"
import { implementation as clearSuggestion } from "./operations/clear-suggestion/server.js"
import { implementation as markDone } from "./operations/mark-done/server.js"
import { implementation as scan } from "./operations/scan/server.js"
import { implementation as skip } from "./operations/skip/server.js"
import { implementation as snooze } from "./operations/snooze/server.js"

type Inbox = { threads: { id: string }[] }

const person = personActor("inbox-alone")

function bindInboxPairs(target: Registry) {
  bindOperation(target, acceptSuggestion)
  bindOperation(target, clearSuggestion)
  bindOperation(target, markDone)
  bindOperation(target, scan)
  bindOperation(target, skip)
  bindOperation(target, snooze)
}

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
    email: "inbox-alone@example.com",
  })
  registry = new Registry()
  registerInbox(registry)
  bindInboxPairs(registry)
})

afterAll(async () => {
  await close()
})

describe("Inbox with nothing else registered", () => {
  it("reads mail in, lists it and takes a thread off the list when it is done", async () => {
    await withDatabase(db, async () => {
      await registry.execute({ name: "inbox.scan", input: {}, actor: person })
      const before = (await registry.read("inbox.list", {}, person)) as Inbox
      const threadId = before.threads[0]?.id
      expect(threadId).toEqual(expect.any(String))
      await registry.execute({
        name: "inbox.markDone",
        input: { threadId },
        actor: person,
      })
      const after = (await registry.read("inbox.list", {}, person)) as Inbox
      expect(after.threads.map((thread) => thread.id)).not.toContain(threadId)
      expect(after.threads).toHaveLength(before.threads.length - 1)
    })
  })

  it("registers again on a second registry", () => {
    const second = new Registry()
    registerInbox(second)
    registerInbox(second)
    bindInboxPairs(second)
    expect(second.list().commands.length).toBe(registry.list().commands.length)
  })
})
