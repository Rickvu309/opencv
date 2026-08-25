import {
  APPLY_COMMANDS,
  ERROR_CODES,
  PAPER_COMMANDS,
  type ApplyCard,
  type PaperDoc,
} from "@workspace/domain"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { applyCards, paperDocs, user as userTable } from "../db/schema.js"
import { createMigratedTestDb } from "../test/harness.js"
import { applyCommands } from "./apply.js"
import { commandRegistry } from "./index.js"
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

function expectNoFit(value: unknown) {
  expect(JSON.stringify(value)).not.toMatch(/"fit"/)
}

describe("apply command flags", () => {
  it("marks delete as destructive and forbids the Coach", () => {
    const byName = Object.fromEntries(
      applyCommands.map((command) => [command.name, command])
    )

    expect(byName[APPLY_COMMANDS.createCard]).toMatchObject({
      coachAllowed: true,
      destructive: false,
    })
    expect(byName[APPLY_COMMANDS.updateCard]).toMatchObject({
      coachAllowed: true,
      destructive: false,
    })
    expect(byName[APPLY_COMMANDS.moveCard]).toMatchObject({
      coachAllowed: true,
      destructive: false,
    })
    expect(byName[APPLY_COMMANDS.toggleStar]).toMatchObject({
      coachAllowed: true,
      destructive: false,
    })
    expect(byName[APPLY_COMMANDS.deleteCard]).toMatchObject({
      coachAllowed: false,
      destructive: true,
      reversal: { possible: false },
    })
  })
})

describe("apply commands", () => {
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
        id: "apply-user-a",
        name: "A",
        email: "apply-a@example.com",
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "apply-user-b",
        name: "B",
        email: "apply-b@example.com",
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ])
    ownerId = "apply-user-a"
    otherId = "apply-user-b"
  }, 60_000)

  afterAll(async () => {
    await client.close()
  })

  it("creates a card without exposing fit, while storing it on the row", async () => {
    const result = await commandRegistry.execute({
      name: APPLY_COMMANDS.createCard,
      input: { title: "Product intern", company: "Fintech scale-up" },
      actor: userActor(ownerId),
      db,
    })

    expect(result.status).toBe(200)
    const card = successData<ApplyCard>(result)
    expect(card).toMatchObject({
      title: "Product intern",
      company: "Fintech scale-up",
      stage: "inbox",
      starred: false,
      trackKind: "followup",
    })
    expect(card.position.length).toBeGreaterThan(0)
    expectNoFit(card)

    const [row] = await db
      .select()
      .from(applyCards)
      .where(eq(applyCards.id, card.id))
    expect(row?.fit).toBe(0)
  })

  it("moves a card between and within a Stage using one-row fractional keys", async () => {
    const first = successData<ApplyCard>(
      await commandRegistry.execute({
        name: APPLY_COMMANDS.createCard,
        input: { title: "First", company: "A", stage: "prep" },
        actor: userActor(ownerId),
        db,
      })
    )
    const second = successData<ApplyCard>(
      await commandRegistry.execute({
        name: APPLY_COMMANDS.createCard,
        input: { title: "Second", company: "B", stage: "prep" },
        actor: userActor(ownerId),
        db,
      })
    )
    const incoming = successData<ApplyCard>(
      await commandRegistry.execute({
        name: APPLY_COMMANDS.createCard,
        input: { title: "Incoming", company: "C", stage: "inbox" },
        actor: userActor(ownerId),
        db,
      })
    )

    const movedIn = successData<ApplyCard>(
      await commandRegistry.execute({
        name: APPLY_COMMANDS.moveCard,
        input: {
          cardId: incoming.id,
          stage: "prep",
          beforeCardId: second.id,
        },
        actor: userActor(ownerId),
        db,
      })
    )
    expect(movedIn.stage).toBe("prep")
    expect(movedIn.position > first.position).toBe(true)
    expect(movedIn.position < second.position).toBe(true)
    expectNoFit(movedIn)

    const movedFront = successData<ApplyCard>(
      await commandRegistry.execute({
        name: APPLY_COMMANDS.moveCard,
        input: {
          cardId: second.id,
          stage: "prep",
          beforeCardId: first.id,
        },
        actor: userActor(ownerId),
        db,
      })
    )
    expect(movedFront.position < first.position).toBe(true)
  })

  it("toggles star and updates editable fields", async () => {
    const created = successData<ApplyCard>(
      await commandRegistry.execute({
        name: APPLY_COMMANDS.createCard,
        input: { title: "Analyst", company: "Bank" },
        actor: userActor(ownerId),
        db,
      })
    )

    const starred = successData<ApplyCard>(
      await commandRegistry.execute({
        name: APPLY_COMMANDS.toggleStar,
        input: { cardId: created.id },
        actor: userActor(ownerId),
        db,
      })
    )
    expect(starred.starred).toBe(true)

    const updated = successData<ApplyCard>(
      await commandRegistry.execute({
        name: APPLY_COMMANDS.updateCard,
        input: {
          cardId: created.id,
          note: "Prep SQL",
          trackDate: "2026-08-26",
          trackKind: "interview",
        },
        actor: userActor(ownerId),
        db,
      })
    )
    expect(updated).toMatchObject({
      note: "Prep SQL",
      trackDate: "2026-08-26",
      trackKind: "interview",
    })
    expectNoFit(updated)
  })

  it("blocks the Coach from deleting an Apply card", async () => {
    const created = successData<ApplyCard>(
      await commandRegistry.execute({
        name: APPLY_COMMANDS.createCard,
        input: { title: "Keep", company: "Agency" },
        actor: userActor(ownerId),
        db,
      })
    )

    const result = await commandRegistry.execute({
      name: APPLY_COMMANDS.deleteCard,
      input: { cardId: created.id },
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

  it("forbids another user from mutating an Apply card", async () => {
    const created = successData<ApplyCard>(
      await commandRegistry.execute({
        name: APPLY_COMMANDS.createCard,
        input: { title: "Private", company: "Local" },
        actor: userActor(ownerId),
        db,
      })
    )

    const result = await commandRegistry.execute({
      name: APPLY_COMMANDS.updateCard,
      input: { cardId: created.id, title: "Stolen" },
      actor: userActor(otherId),
      db,
    })

    expect(result.status).toBe(403)
    expect(result.body).toEqual({
      ok: false,
      error: {
        code: ERROR_CODES.FORBIDDEN,
        message: "You cannot access this Apply card",
      },
    })
  })

  it("links and unlinks a Paper doc, and nulls the link when the card is deleted", async () => {
    const card = successData<ApplyCard>(
      await commandRegistry.execute({
        name: APPLY_COMMANDS.createCard,
        input: { title: "Associate PM intern", company: "Local startup" },
        actor: userActor(ownerId),
        db,
      })
    )
    const doc = successData<PaperDoc>(
      await commandRegistry.execute({
        name: PAPER_COMMANDS.createDoc,
        input: { kind: "letter", name: "Cover: Local startup" },
        actor: userActor(ownerId),
        db,
      })
    )

    const linked = successData<PaperDoc>(
      await commandRegistry.execute({
        name: PAPER_COMMANDS.linkApplyCard,
        input: { docId: doc.id, applyCardId: card.id },
        actor: userActor(ownerId),
        db,
      })
    )
    expect(linked.applyCardId).toBe(card.id)

    const unlinked = successData<PaperDoc>(
      await commandRegistry.execute({
        name: PAPER_COMMANDS.linkApplyCard,
        input: { docId: doc.id, applyCardId: null },
        actor: userActor(ownerId),
        db,
      })
    )
    expect(unlinked.applyCardId).toBeNull()

    const relinked = successData<PaperDoc>(
      await commandRegistry.execute({
        name: PAPER_COMMANDS.linkApplyCard,
        input: { docId: doc.id, applyCardId: card.id },
        actor: userActor(ownerId),
        db,
      })
    )
    expect(relinked.applyCardId).toBe(card.id)

    await commandRegistry.execute({
      name: APPLY_COMMANDS.deleteCard,
      input: { cardId: card.id },
      actor: userActor(ownerId),
      db,
    })

    const [row] = await db
      .select()
      .from(paperDocs)
      .where(eq(paperDocs.id, doc.id))
    expect(row?.applyCardId).toBeNull()
  })
})
