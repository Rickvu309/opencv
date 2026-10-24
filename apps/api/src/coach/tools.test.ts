import {
  APPLY_CARD_ID_MISSING_COPY,
  APPLY_COMMANDS,
  COACH_READ_TOOLS,
  COACH_VOICE_COMMAND,
  ERROR_CODES,
  INVALID_CARD_ID_COPY,
  PAPER_COMMANDS,
  PAPER_CONTENT_VERSION,
  PITCH_COMMANDS,
  PITCH_SCOPED_NO_APPLY_COPY,
  PROFILE_COMMANDS,
  THREAD_COMMANDS,
  emptyLetterDocument,
  emptyPitchDocument,
  type ApplyCard,
  type CommandEnvelope,
  type PaperDoc,
  type ThreadListItem,
  type UserProfile,
} from "@workspace/domain"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { commandRegistry } from "../commands/index.js"
import type { CommandExecution } from "../commands/registry.js"
import { user as userTable } from "../db/schema.js"
import { listApplyCardsForUser } from "../apply/queries.js"
import { getPaperDocDetail, listPaperDocsForUser } from "../paper/queries.js"
import { getProfileForUser } from "../profile/queries.js"
import { createMigratedTestDb } from "../test/harness.js"
import { repairPaperUpdateInput } from "./must-edit-repair.js"
import { withApplyCardIdGuard } from "./apply-card-guard.js"
import {
  assembleTurnCoachTools,
  jsonSchemaForCoachInput,
  toAiSdkTools,
  withMustEditRepair,
} from "./runtime.js"
import {
  assembleCoachTools,
  commandToToolName,
  executeCoachMutation,
  isCoachMutationCommand,
} from "./tools.js"

const EXPECTED_COACH_TOOLS = [
  "apply_createCard",
  "apply_listCards",
  "apply_moveCard",
  "apply_toggleStar",
  "apply_updateCard",
  "paper_createDoc",
  "paper_getDoc",
  "paper_linkApplyCard",
  "paper_listDocs",
  "paper_renameDoc",
  "paper_setStatus",
  "paper_updateContent",
  "pitch_update",
  "profile_get",
  "threads_create",
  "threads_rename",
] as const

function successData<T>(result: CommandExecution): T {
  expect(result.body.ok).toBe(true)
  if (!result.body.ok) throw new Error("expected command success")
  return result.body.data as T
}

function expectOk<T>(envelope: CommandEnvelope): T {
  expect(envelope.ok).toBe(true)
  if (!envelope.ok) throw new Error("expected tool success")
  return envelope.data as T
}

function coachActor(userId: string) {
  return { type: "coach" as const, userId }
}

describe("coach tool surface", () => {
  let db: Awaited<ReturnType<typeof createMigratedTestDb>>["db"]
  let client: Awaited<ReturnType<typeof createMigratedTestDb>>["client"]
  let ownerId: string

  beforeAll(async () => {
    const migrated = await createMigratedTestDb()
    db = migrated.db
    client = migrated.client

    await db.insert(userTable).values({
      id: "coach-tools-user",
      name: "Minh",
      email: "coach-tools@example.com",
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    ownerId = "coach-tools-user"
  }, 60_000)

  afterAll(async () => {
    await client.close()
  })

  it("assembles the exact 12-mutation + read surface", () => {
    const tools = assembleCoachTools({ db, userId: ownerId })
    const names = Object.keys(tools).sort()

    expect(names).toEqual([...EXPECTED_COACH_TOOLS])
    expect(names).toHaveLength(16)

    expect(names).not.toContain(commandToToolName(COACH_VOICE_COMMAND))
    expect(names).not.toContain(commandToToolName(THREAD_COMMANDS.postMessage))
    expect(names.filter((name) => name.includes("delete"))).toEqual([])
    expect(names).not.toContain(commandToToolName(PAPER_COMMANDS.deleteDoc))
    expect(names).not.toContain(commandToToolName(APPLY_COMMANDS.deleteCard))
    expect(names).not.toContain(commandToToolName(THREAD_COMMANDS.delete))
    expect(names.filter((name) => name.includes("postMessage"))).toEqual([])

    expect(names).toEqual(
      expect.arrayContaining(Object.values(COACH_READ_TOOLS))
    )
  })

  it("gives every assembled tool a human description", () => {
    const tools = assembleCoachTools({ db, userId: ownerId })

    for (const [name, tool] of Object.entries(tools)) {
      expect(tool.description.length, name).toBeGreaterThan(0)
    }

    for (const command of commandRegistry.list()) {
      expect(command.description.length, command.name).toBeGreaterThan(0)
    }
  })

  it("maps Command names from dotted form to provider-safe tool names", () => {
    expect(commandToToolName(PAPER_COMMANDS.createDoc)).toBe("paper_createDoc")
    expect(commandToToolName(THREAD_COMMANDS.postMessage)).toBe(
      "threads_postMessage"
    )
  })

  it("executes a mutation through the registry with a coach actor", async () => {
    const tools = assembleCoachTools({ db, userId: ownerId })

    const created = expectOk<ThreadListItem>(
      await tools.threads_create.execute({ title: "Tool-built Thread" })
    )
    expect(created.title).toBe("Tool-built Thread")

    const renamed = expectOk<ThreadListItem>(
      await tools.threads_rename.execute({
        threadId: created.id,
        title: "Tool-renamed Thread",
      })
    )
    expect(renamed).toEqual(
      expect.objectContaining({ id: created.id, title: "Tool-renamed Thread" })
    )
  })

  it("returns error envelopes on bad tool input rather than throwing", async () => {
    const tools = assembleCoachTools({ db, userId: ownerId })

    await expect(
      tools.threads_rename.execute({ threadId: "not-a-uuid", title: "" })
    ).resolves.toEqual({
      ok: false,
      error: expect.objectContaining({ code: ERROR_CODES.VALIDATION_ERROR }),
    })

    await expect(
      tools.paper_getDoc.execute({ docId: "nope" })
    ).resolves.toEqual({
      ok: false,
      error: expect.objectContaining({ code: ERROR_CODES.VALIDATION_ERROR }),
    })

    await expect(
      tools.apply_createCard.execute({ title: "" })
    ).resolves.toEqual({
      ok: false,
      error: expect.objectContaining({ code: ERROR_CODES.VALIDATION_ERROR }),
    })

    await expect(tools.profile_get.execute({ extra: true })).resolves.toEqual({
      ok: false,
      error: expect.objectContaining({ code: ERROR_CODES.VALIDATION_ERROR }),
    })
  })

  it("returns read DTOs that match the User GET mappers", async () => {
    const createdDoc = successData<PaperDoc>(
      await commandRegistry.execute({
        name: PAPER_COMMANDS.createDoc,
        input: { kind: "letter", name: "Read parity letter" },
        actor: coachActor(ownerId),
        db,
      })
    )
    successData<ApplyCard>(
      await commandRegistry.execute({
        name: APPLY_COMMANDS.createCard,
        input: { title: "Read parity role", company: "Acme" },
        actor: coachActor(ownerId),
        db,
      })
    )

    const tools = assembleCoachTools({ db, userId: ownerId })

    const listedDocs = expectOk<PaperDoc[]>(
      await tools.paper_listDocs.execute({})
    )
    expect(listedDocs).toEqual(await listPaperDocsForUser(db, ownerId))

    const gotDoc = expectOk<PaperDoc>(
      await tools.paper_getDoc.execute({ docId: createdDoc.id })
    )
    expect(gotDoc).toEqual(await getPaperDocDetail(db, ownerId, createdDoc.id))

    const listedCards = expectOk<ApplyCard[]>(
      await tools.apply_listCards.execute({})
    )
    expect(listedCards).toEqual(await listApplyCardsForUser(db, ownerId))
    expect(JSON.stringify(listedCards)).not.toMatch(/"fit"/)

    const profile = expectOk<UserProfile>(await tools.profile_get.execute({}))
    expect(profile).toEqual(await getProfileForUser(db, ownerId))
    expect(profile).toMatchObject({
      id: ownerId,
      name: "Minh",
      email: "coach-tools@example.com",
      coachMode: "free",
    })
    expect(profile).not.toHaveProperty("token")
    expect(profile).not.toHaveProperty("password")
  })

  it("refuses a destructive Command without executing it", async () => {
    const created = successData<PaperDoc>(
      await commandRegistry.execute({
        name: PAPER_COMMANDS.createDoc,
        input: { kind: "letter", name: "Keep this letter" },
        actor: { type: "user", userId: ownerId },
        db,
      })
    )
    const command = commandRegistry.get(PAPER_COMMANDS.deleteDoc)
    expect(command?.destructive).toBe(true)

    const envelope = await executeCoachMutation({
      command: command!,
      input: { docId: created.id },
      db,
      userId: ownerId,
      registry: commandRegistry,
    })

    expect(envelope).toEqual({
      ok: false,
      error: {
        code: ERROR_CODES.COACH_NOT_ALLOWED,
        message: "This Command cannot be run by the Coach",
      },
    })
    expect(await getPaperDocDetail(db, ownerId, created.id)).toEqual(
      expect.objectContaining({ id: created.id, name: "Keep this letter" })
    )
  })

  it("rejects a bumped contentVersion until repair rewrites it to the supported schema", async () => {
    const created = successData<PaperDoc>(
      await commandRegistry.execute({
        name: PAPER_COMMANDS.createDoc,
        input: { kind: "letter", name: "Repair letter" },
        actor: coachActor(ownerId),
        db,
      })
    )
    const tools = assembleCoachTools({ db, userId: ownerId })
    const stale = {
      docId: created.id,
      contentVersion: 2,
      content: { markdown: "Rewritten for a product internship." },
    }

    await expect(tools.paper_updateContent.execute(stale)).resolves.toEqual({
      ok: false,
      error: expect.objectContaining({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: "Unsupported content version",
      }),
    })

    const repaired = repairPaperUpdateInput(stale, {
      id: created.id,
      name: created.name,
      kind: "letter",
      status: created.status,
      content: created.content,
      contentVersion: created.contentVersion,
    })
    expect(repaired?.contentVersion).toBe(PAPER_CONTENT_VERSION)

    const applied = expectOk<PaperDoc>(
      await tools.paper_updateContent.execute(repaired)
    )
    expect(applied.content).toEqual({
      markdown: "Rewritten for a product internship.",
    })
    expect(applied.contentVersion).toBe(PAPER_CONTENT_VERSION)
  })

  it("scopes a Pitch café ask off Apply mutations and refuses invented card ids", async () => {
    const polish =
      "What should I put on my Pitch page before I share the link? I have two Proofs ready and a draft CV."
    const pitchTools = assembleTurnCoachTools({
      db,
      userId: ownerId,
      userText: polish,
    })
    expect(pitchTools.apply_moveCard).toBeUndefined()
    expect(pitchTools.apply_createCard).toBeUndefined()
    expect(pitchTools.apply_updateCard).toBeUndefined()
    expect(pitchTools.apply_toggleStar).toBeUndefined()
    expect(pitchTools.paper_linkApplyCard).toBeUndefined()
    expect(pitchTools.apply_listCards).toBeDefined()
    expect(pitchTools.pitch_update).toBeDefined()

    const applyTools = assembleTurnCoachTools({
      db,
      userId: ownerId,
      userText: "Move my starred card to Prep.",
    })
    const move = applyTools.apply_moveCard
    expect(move).toBeDefined()
    if (!move) throw new Error("expected apply_moveCard on an Apply ask")
    const invented = await move.execute({
      cardId: "00000000-0000-0000-0000-000000000002",
      stage: "prep",
    })
    expect(invented).toEqual({
      ok: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: APPLY_CARD_ID_MISSING_COPY,
      },
    })
    expect(invented.ok === false && invented.error.message).not.toBe(
      INVALID_CARD_ID_COPY
    )
    expect(PITCH_SCOPED_NO_APPLY_COPY).not.toBe(INVALID_CARD_ID_COPY)
  })

  it("converts every assembled tool, including repaired paper_updateContent, to JSON Schema", async () => {
    const surface = withApplyCardIdGuard(
      withMustEditRepair(assembleCoachTools({ db, userId: ownerId }))
    )
    const tools = toAiSdkTools(surface)
    expect(Object.keys(tools).sort()).toEqual([...EXPECTED_COACH_TOOLS])

    for (const [name, tool] of Object.entries(tools)) {
      const json = await Promise.resolve(
        jsonSchemaForCoachInput(tool.inputSchema)
      )
      expect(json, name).toMatchObject({ type: "object" })
      expect(typeof json, name).not.toBe("function")
    }
  })
})

describe("coach-actor command sweep", () => {
  let db: Awaited<ReturnType<typeof createMigratedTestDb>>["db"]
  let client: Awaited<ReturnType<typeof createMigratedTestDb>>["client"]
  let ownerId: string

  beforeAll(async () => {
    const migrated = await createMigratedTestDb()
    db = migrated.db
    client = migrated.client

    await db.insert(userTable).values({
      id: "coach-sweep-user",
      name: "Lan",
      email: "coach-sweep@example.com",
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    ownerId = "coach-sweep-user"
  }, 60_000)

  afterAll(async () => {
    await client.close()
  })

  it("treats destructive Commands as coach-forbidden; User-only prefs may also be", () => {
    const commands = commandRegistry.list()
    expect(commands.length).toBeGreaterThan(0)

    for (const command of commands) {
      if (command.destructive) {
        expect(command.coachAllowed, command.name).toBe(false)
      }
    }
    expect(
      commands.find((command) => command.name === PROFILE_COMMANDS.setCoachMode)
    ).toMatchObject({
      coachAllowed: false,
      destructive: false,
    })

    const mutationTools = commands.filter(isCoachMutationCommand)
    expect(mutationTools).toHaveLength(12)
    expect(mutationTools.map((command) => command.name)).not.toContain(
      COACH_VOICE_COMMAND
    )
  })

  it("executes every coach-allowed Command and blocks every forbidden one", async () => {
    const thread = successData<ThreadListItem>(
      await commandRegistry.execute({
        name: THREAD_COMMANDS.create,
        input: { title: "Sweep thread" },
        actor: coachActor(ownerId),
        db,
      })
    )
    const letter = successData<PaperDoc>(
      await commandRegistry.execute({
        name: PAPER_COMMANDS.createDoc,
        input: { kind: "letter", name: "Sweep letter" },
        actor: coachActor(ownerId),
        db,
      })
    )
    const card = successData<ApplyCard>(
      await commandRegistry.execute({
        name: APPLY_COMMANDS.createCard,
        input: { title: "Sweep intern", company: "OpenCV" },
        actor: coachActor(ownerId),
        db,
      })
    )

    const inputFor = (name: string): unknown => {
      switch (name) {
        case THREAD_COMMANDS.create:
          return { title: "Sweep created" }
        case THREAD_COMMANDS.rename:
          return { threadId: thread.id, title: "Sweep renamed" }
        case THREAD_COMMANDS.postMessage:
          return { threadId: thread.id, text: "Sweep says hello" }
        case THREAD_COMMANDS.delete:
          return { threadId: thread.id }
        case PAPER_COMMANDS.createDoc:
          return { kind: "proof", name: "Sweep proof" }
        case PAPER_COMMANDS.updateContent:
          return {
            docId: letter.id,
            content: emptyLetterDocument(),
            contentVersion: PAPER_CONTENT_VERSION,
          }
        case PAPER_COMMANDS.renameDoc:
          return { docId: letter.id, name: "Sweep letter renamed" }
        case PAPER_COMMANDS.setStatus:
          return { docId: letter.id, status: "ready" }
        case PAPER_COMMANDS.linkApplyCard:
          return { docId: letter.id, applyCardId: card.id }
        case PAPER_COMMANDS.deleteDoc:
          return { docId: letter.id }
        case APPLY_COMMANDS.createCard:
          return { title: "Sweep second", company: "Beta" }
        case APPLY_COMMANDS.updateCard:
          return { cardId: card.id, note: "Sweep note" }
        case APPLY_COMMANDS.moveCard:
          return { cardId: card.id, stage: "prep" }
        case APPLY_COMMANDS.toggleStar:
          return { cardId: card.id }
        case APPLY_COMMANDS.deleteCard:
          return { cardId: card.id }
        case PROFILE_COMMANDS.setCoachMode:
          return { mode: "light" }
        case PITCH_COMMANDS.update:
          return {
            content: emptyPitchDocument(),
            contentVersion: 1,
          }
        default:
          throw new Error(`missing sweep input for ${name}`)
      }
    }

    const allowed = commandRegistry
      .list()
      .filter((command) => command.coachAllowed)
    const forbidden = commandRegistry
      .list()
      .filter((command) => !command.coachAllowed)

    expect(allowed.length).toBe(13)
    expect(forbidden.map((command) => command.name).sort()).toEqual([
      APPLY_COMMANDS.deleteCard,
      PAPER_COMMANDS.deleteDoc,
      PROFILE_COMMANDS.setCoachMode,
      THREAD_COMMANDS.delete,
    ])

    for (const command of allowed) {
      const result = await commandRegistry.execute({
        name: command.name,
        input: inputFor(command.name),
        actor: coachActor(ownerId),
        db,
      })
      expect(result.status, command.name).toBe(200)
      expect(result.body.ok, command.name).toBe(true)
    }

    for (const command of forbidden) {
      const result = await commandRegistry.execute({
        name: command.name,
        input: inputFor(command.name),
        actor: coachActor(ownerId),
        db,
      })
      expect(result.status, command.name).toBe(403)
      expect(result.body).toEqual({
        ok: false,
        error: {
          code: ERROR_CODES.COACH_NOT_ALLOWED,
          message: "This Command cannot be run by the Coach",
        },
      })
    }
  })
})
