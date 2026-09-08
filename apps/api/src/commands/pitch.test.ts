import {
  ERROR_CODES,
  PITCH_COMMANDS,
  emptyPitchDocument,
  starterPitchDocument,
  type PitchDoc,
} from "@workspace/domain"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { user as userTable } from "../db/schema.js"
import { createMigratedTestDb } from "../test/harness.js"
import { commandRegistry } from "./index.js"
import { pitchCommands } from "./pitch.js"
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

describe("pitch command flags", () => {
  it("allows the Coach to update Pitch and is not destructive", () => {
    expect(pitchCommands).toHaveLength(1)
    expect(pitchCommands[0]).toMatchObject({
      name: PITCH_COMMANDS.update,
      coachAllowed: true,
      destructive: false,
      reversal: { possible: true, command: PITCH_COMMANDS.update },
    })
  })
})

describe("pitch commands", () => {
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
        id: "pitch-user-a",
        name: "A",
        email: "pitch-a@example.com",
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "pitch-user-b",
        name: "B",
        email: "pitch-b@example.com",
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ])
    ownerId = "pitch-user-a"
    otherId = "pitch-user-b"
  }, 60_000)

  afterAll(async () => {
    await client.close()
  })

  it("rejects malformed content with a validation envelope", async () => {
    const result = await commandRegistry.execute({
      name: PITCH_COMMANDS.update,
      input: { content: { headline: 4 }, contentVersion: 1 },
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

  it("upserts one Pitch document per user", async () => {
    const created = await commandRegistry.execute({
      name: PITCH_COMMANDS.update,
      input: { content: emptyPitchDocument(), contentVersion: 1 },
      actor: userActor(ownerId),
      db,
    })
    const first = successData<PitchDoc>(created)
    expect(first.kind).toBe("pitch")
    expect(first.contentVersion).toBe(1)

    const next = { ...starterPitchDocument(), about: "Edited about." }
    const updated = await commandRegistry.execute({
      name: PITCH_COMMANDS.update,
      input: { content: next, contentVersion: 1 },
      actor: userActor(ownerId),
      db,
    })
    const second = successData<PitchDoc>(updated)
    expect(second.id).toBe(first.id)
    expect(second.content).toEqual(next)

    const other = await commandRegistry.execute({
      name: PITCH_COMMANDS.update,
      input: { content: starterPitchDocument(), contentVersion: 1 },
      actor: userActor(otherId),
      db,
    })
    const otherDoc = successData<PitchDoc>(other)
    expect(otherDoc.id).not.toBe(first.id)
    expect(otherDoc.content).toEqual(starterPitchDocument())
  })

  it("lets the Coach update Pitch", async () => {
    const result = await commandRegistry.execute({
      name: PITCH_COMMANDS.update,
      input: {
        content: { ...emptyPitchDocument(), headline: "Coach edit" },
        contentVersion: 1,
      },
      actor: coachActor(ownerId),
      db,
    })
    expect(result.status).toBe(200)
    expect(successData<PitchDoc>(result).content).toEqual(
      expect.objectContaining({ headline: "Coach edit" })
    )
  })
})
