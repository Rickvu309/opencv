import {
  DEFAULT_THREAD_TITLE,
  ERROR_CODES,
  STUB_COACH_REPLY,
  THREAD_COMMANDS,
} from "@workspace/domain"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { user as userTable } from "../db/schema.js"
import { createMigratedTestDb } from "../test/harness.js"
import { commandRegistry } from "./index.js"
import type { CommandExecution } from "./registry.js"
import { threadCommands } from "./threads.js"

function successData<T>(result: CommandExecution): T {
  expect(result.body.ok).toBe(true)
  if (!result.body.ok) throw new Error("expected command success")
  return result.body.data as T
}

function userActor(userId: string) {
  return { type: "user" as const, userId }
}

function coachActor(userId: string) {
  return { type: "coach" as const, userId }
}

describe("command flags", () => {
  it("marks delete as destructive and forbids the Coach", () => {
    const byName = Object.fromEntries(
      threadCommands.map((command) => [command.name, command])
    )

    expect(byName[THREAD_COMMANDS.create]).toMatchObject({
      coachAllowed: true,
      destructive: false,
    })
    expect(byName[THREAD_COMMANDS.rename]).toMatchObject({
      coachAllowed: true,
      destructive: false,
    })
    expect(byName[THREAD_COMMANDS.postMessage]).toMatchObject({
      coachAllowed: true,
      destructive: false,
    })
    expect(byName[THREAD_COMMANDS.delete]).toMatchObject({
      coachAllowed: false,
      destructive: true,
      reversal: { possible: false },
    })
  })
})

describe("command registry", () => {
  let db: Awaited<ReturnType<typeof createMigratedTestDb>>["db"]
  let client: Awaited<ReturnType<typeof createMigratedTestDb>>["client"]
  let ownerId: string
  let otherId: string

  beforeAll(async () => {
    const migrated = await createMigratedTestDb()
    db = migrated.db
    client = migrated.client

    await db.insert(userTable).values([
      {
        id: "user-a",
        name: "A",
        email: "a@example.com",
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "user-b",
        name: "B",
        email: "b@example.com",
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ])
    ownerId = "user-a"
    otherId = "user-b"
  }, 60_000)

  afterAll(async () => {
    await client.close()
  })

  it("rejects an unknown command", async () => {
    const result = await commandRegistry.execute({
      name: "threads.explode",
      input: {},
      actor: userActor(ownerId),
      db,
    })

    expect(result.status).toBe(404)
    expect(result.body).toEqual({
      ok: false,
      error: { code: ERROR_CODES.UNKNOWN_COMMAND, message: "Unknown command" },
    })
  })

  it("rejects invalid input", async () => {
    const result = await commandRegistry.execute({
      name: THREAD_COMMANDS.rename,
      input: { threadId: "not-a-uuid", title: "" },
      actor: userActor(ownerId),
      db,
    })

    expect(result.status).toBe(400)
    expect(result.body).toEqual({
      ok: false,
      error: expect.objectContaining({ code: ERROR_CODES.VALIDATION_ERROR }),
    })
  })

  it("blocks the Coach from a destructive Command", async () => {
    const created = await commandRegistry.execute({
      name: THREAD_COMMANDS.create,
      input: { title: "Keep me" },
      actor: userActor(ownerId),
      db,
    })
    const createdData = successData<{ id: string }>(created)

    const result = await commandRegistry.execute({
      name: THREAD_COMMANDS.delete,
      input: { threadId: createdData.id },
      actor: coachActor(ownerId),
      db,
    })

    expect(result.status).toBe(403)
    expect(result.body).toEqual({
      ok: false,
      error: {
        code: ERROR_CODES.COACH_NOT_ALLOWED,
        message: "This Command cannot be run by the Coach",
      },
    })
  })

  it("lets the Coach run a non-destructive Command", async () => {
    const created = await commandRegistry.execute({
      name: THREAD_COMMANDS.create,
      input: {},
      actor: userActor(ownerId),
      db,
    })
    const createdData = successData<{ id: string; title: string }>(created)
    expect(createdData.title).toBe(DEFAULT_THREAD_TITLE)

    const renamed = await commandRegistry.execute({
      name: THREAD_COMMANDS.rename,
      input: { threadId: createdData.id, title: "Coach rename" },
      actor: coachActor(ownerId),
      db,
    })

    expect(renamed.status).toBe(200)
    expect(renamed.body).toEqual({
      ok: true,
      data: expect.objectContaining({ title: "Coach rename" }),
    })
  })

  it("forbids another user from mutating a Thread", async () => {
    const created = await commandRegistry.execute({
      name: THREAD_COMMANDS.create,
      input: { title: "Private" },
      actor: userActor(ownerId),
      db,
    })
    const createdData = successData<{ id: string }>(created)

    const result = await commandRegistry.execute({
      name: THREAD_COMMANDS.postMessage,
      input: { threadId: createdData.id, text: "hello" },
      actor: userActor(otherId),
      db,
    })

    expect(result.status).toBe(403)
    expect(result.body).toEqual({
      ok: false,
      error: {
        code: ERROR_CODES.FORBIDDEN,
        message: "You cannot access this Thread",
      },
    })
  })

  it("appends the user message and the honest stub Coach reply", async () => {
    const created = await commandRegistry.execute({
      name: THREAD_COMMANDS.create,
      input: { title: "Chat" },
      actor: userActor(ownerId),
      db,
    })
    const createdData = successData<{ id: string }>(created)

    const posted = await commandRegistry.execute({
      name: THREAD_COMMANDS.postMessage,
      input: { threadId: createdData.id, text: "  Should I finish my CV?  " },
      actor: userActor(ownerId),
      db,
    })

    expect(posted.status).toBe(200)
    const postedData = successData<{ messages: unknown[] }>(posted)
    expect(postedData.messages).toEqual([
      expect.objectContaining({
        role: "user",
        text: "Should I finish my CV?",
      }),
      expect.objectContaining({
        role: "coach",
        text: STUB_COACH_REPLY,
      }),
    ])
    expect(STUB_COACH_REPLY).toMatch(/haven't run any Commands/i)
  })
})
