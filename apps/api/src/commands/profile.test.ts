import {
  DEFAULT_COACH_MODE,
  ERROR_CODES,
  PROFILE_COMMANDS,
  type UserProfile,
} from "@workspace/domain"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { user as userTable } from "../db/schema.js"
import { getProfileForUser } from "../profile/queries.js"
import {
  authHeaders,
  createMigratedTestDb,
  createTestApp,
  signUp,
} from "../test/harness.js"
import { commandRegistry } from "./index.js"
import type { CommandExecution } from "./registry.js"

function successData<T>(result: CommandExecution): T {
  expect(result.body.ok).toBe(true)
  if (!result.body.ok) throw new Error("expected command success")
  return result.body.data as T
}

describe("profile.setCoachMode", () => {
  let db: Awaited<ReturnType<typeof createMigratedTestDb>>["db"]
  let client: Awaited<ReturnType<typeof createMigratedTestDb>>["client"]
  const ownerId = "profile-mode-user"

  beforeAll(async () => {
    const migrated = await createMigratedTestDb()
    db = migrated.db
    client = migrated.client
    await db.insert(userTable).values({
      id: ownerId,
      name: "Minh",
      email: "profile-mode@example.com",
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  }, 60_000)

  afterAll(async () => {
    await client.close()
  })

  it("defaults new Users to free and round-trips a preference", async () => {
    const before = await getProfileForUser(db, ownerId)
    expect(before.coachMode).toBe(DEFAULT_COACH_MODE)

    const updated = successData<UserProfile>(
      await commandRegistry.execute({
        name: PROFILE_COMMANDS.setCoachMode,
        input: { mode: "max" },
        actor: { type: "user", userId: ownerId },
        db,
      })
    )
    expect(updated.coachMode).toBe("max")
    expect(await getProfileForUser(db, ownerId)).toMatchObject({
      id: ownerId,
      coachMode: "max",
    })

    successData<UserProfile>(
      await commandRegistry.execute({
        name: PROFILE_COMMANDS.setCoachMode,
        input: { mode: "light" },
        actor: { type: "user", userId: ownerId },
        db,
      })
    )
    expect((await getProfileForUser(db, ownerId)).coachMode).toBe("light")
  })

  it("rejects an invalid mode and forbids the Coach", async () => {
    const invalid = await commandRegistry.execute({
      name: PROFILE_COMMANDS.setCoachMode,
      input: { mode: "ultra" },
      actor: { type: "user", userId: ownerId },
      db,
    })
    expect(invalid.status).toBe(400)
    expect(invalid.body.ok).toBe(false)

    const coach = await commandRegistry.execute({
      name: PROFILE_COMMANDS.setCoachMode,
      input: { mode: "free" },
      actor: { type: "coach", userId: ownerId },
      db,
    })
    expect(coach.status).toBe(403)
    expect(coach.body).toEqual({
      ok: false,
      error: {
        code: ERROR_CODES.COACH_NOT_ALLOWED,
        message: "This Command cannot be run by the Coach",
      },
    })
  })
})

describe("GET /api/profile", () => {
  it("returns the signed-in User including coachMode", async () => {
    const { client, db } = await createMigratedTestDb()
    try {
      const app = createTestApp(db)
      const signed = await signUp(app, {
        name: "Lan",
        email: "profile-http@example.com",
        password: "correct-horse-battery",
      })
      const res = await app.request("/api/profile", {
        headers: authHeaders(signed.cookie),
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as {
        ok: true
        data: { coachMode: string; email: string }
      }
      expect(body.ok).toBe(true)
      expect(body.data).toMatchObject({
        email: "profile-http@example.com",
        coachMode: DEFAULT_COACH_MODE,
      })
    } finally {
      await client.close()
    }
  }, 60_000)
})
