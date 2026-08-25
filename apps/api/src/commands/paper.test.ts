import {
  DEFAULT_PAPER_DOC_NAME,
  ERROR_CODES,
  PAPER_COMMANDS,
  emptyLetterDocument,
  type PaperDoc,
} from "@workspace/domain"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { user as userTable } from "../db/schema.js"
import { createMigratedTestDb } from "../test/harness.js"
import { commandRegistry } from "./index.js"
import { paperCommands } from "./paper.js"
import type { CommandExecution } from "./registry.js"

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

describe("paper command flags", () => {
  it("marks delete as destructive and forbids the Coach", () => {
    const byName = Object.fromEntries(
      paperCommands.map((command) => [command.name, command])
    )

    expect(byName[PAPER_COMMANDS.createDoc]).toMatchObject({
      coachAllowed: true,
      destructive: false,
    })
    expect(byName[PAPER_COMMANDS.updateContent]).toMatchObject({
      coachAllowed: true,
      destructive: false,
    })
    expect(byName[PAPER_COMMANDS.renameDoc]).toMatchObject({
      coachAllowed: true,
      destructive: false,
    })
    expect(byName[PAPER_COMMANDS.setStatus]).toMatchObject({
      coachAllowed: true,
      destructive: false,
    })
    expect(byName[PAPER_COMMANDS.linkApplyCard]).toMatchObject({
      coachAllowed: true,
      destructive: false,
    })
    expect(byName[PAPER_COMMANDS.deleteDoc]).toMatchObject({
      coachAllowed: false,
      destructive: true,
      reversal: { possible: false },
    })
  })
})

describe("paper commands", () => {
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
        id: "paper-user-a",
        name: "A",
        email: "paper-a@example.com",
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "paper-user-b",
        name: "B",
        email: "paper-b@example.com",
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ])
    ownerId = "paper-user-a"
    otherId = "paper-user-b"
  }, 60_000)

  afterAll(async () => {
    await client.close()
  })

  it("rejects malformed content with a validation envelope", async () => {
    const created = await commandRegistry.execute({
      name: PAPER_COMMANDS.createDoc,
      input: { kind: "letter" },
      actor: userActor(ownerId),
      db,
    })
    const createdData = successData<PaperDoc>(created)

    const result = await commandRegistry.execute({
      name: PAPER_COMMANDS.updateContent,
      input: {
        docId: createdData.id,
        content: { markdown: 4 },
        contentVersion: 1,
      },
      actor: userActor(ownerId),
      db,
    })

    expect(result.status).toBe(400)
    expect(result.body).toEqual({
      ok: false,
      error: expect.objectContaining({ code: ERROR_CODES.VALIDATION_ERROR }),
    })
    if (result.body.ok) throw new Error("expected validation failure")
    expect(result.body.error.message.length).toBeGreaterThan(0)
  })

  it("rejects a prefixed-string body as content", async () => {
    const result = await commandRegistry.execute({
      name: PAPER_COMMANDS.createDoc,
      input: { kind: "cv", content: "cv:v1:{}" },
      actor: userActor(ownerId),
      db,
    })

    expect(result.status).toBe(400)
    expect(result.body).toEqual({
      ok: false,
      error: expect.objectContaining({ code: ERROR_CODES.VALIDATION_ERROR }),
    })
  })

  it("creates an empty document when content is omitted", async () => {
    const result = await commandRegistry.execute({
      name: PAPER_COMMANDS.createDoc,
      input: { kind: "letter" },
      actor: userActor(ownerId),
      db,
    })

    expect(result.status).toBe(200)
    expect(successData<PaperDoc>(result)).toEqual(
      expect.objectContaining({
        kind: "letter",
        name: DEFAULT_PAPER_DOC_NAME.letter,
        status: "draft",
        contentVersion: 1,
        content: emptyLetterDocument(),
      })
    )
  })

  it("blocks the Coach from deleting a Paper doc", async () => {
    const created = await commandRegistry.execute({
      name: PAPER_COMMANDS.createDoc,
      input: { kind: "proof", name: "Keep me" },
      actor: userActor(ownerId),
      db,
    })
    const createdData = successData<PaperDoc>(created)

    const result = await commandRegistry.execute({
      name: PAPER_COMMANDS.deleteDoc,
      input: { docId: createdData.id },
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

  it("forbids another user from mutating a Paper doc", async () => {
    const created = await commandRegistry.execute({
      name: PAPER_COMMANDS.createDoc,
      input: { kind: "cv", name: "Private" },
      actor: userActor(ownerId),
      db,
    })
    const createdData = successData<PaperDoc>(created)

    const result = await commandRegistry.execute({
      name: PAPER_COMMANDS.renameDoc,
      input: { docId: createdData.id, name: "Stolen" },
      actor: userActor(otherId),
      db,
    })

    expect(result.status).toBe(403)
    expect(result.body).toEqual({
      ok: false,
      error: {
        code: ERROR_CODES.FORBIDDEN,
        message: "You cannot access this Paper doc",
      },
    })
  })
})
