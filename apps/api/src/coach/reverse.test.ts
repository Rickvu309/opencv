import {
  APPLY_COMMANDS,
  ERROR_CODES,
  THREAD_COMMANDS,
  type ApplyCard,
  type CoachReverseResult,
  type ThreadListItem,
  type ThreadMessagePart,
} from "@workspace/domain"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { createApp } from "../app.js"
import { commandRegistry } from "../commands/index.js"
import type { CommandExecution } from "../commands/registry.js"
import { threadMessages } from "../db/schema.js"
import { createId } from "../id.js"
import {
  authHeaders,
  createMigratedTestDb,
  createTestApp,
  signUp,
} from "../test/harness.js"
import { getOwnedApplyCard } from "../apply/queries.js"
import { createDemoCoachRuntime } from "./fake.js"

const userA = {
  name: "Minh",
  email: "minh-reverse@example.com",
  password: "correct-horse-battery",
}
const userB = {
  name: "Lan",
  email: "lan-reverse@example.com",
  password: "correct-horse-battery",
}

function successData<T>(result: CommandExecution): T {
  expect(result.body.ok).toBe(true)
  if (!result.body.ok) throw new Error("expected command success")
  return result.body.data as T
}

async function json<T>(res: Response): Promise<T> {
  return (await res.json()) as T
}

async function sessionUserId(
  app: ReturnType<typeof createTestApp>,
  cookie: string
) {
  const res = await app.request("/api/session", {
    headers: authHeaders(cookie),
  })
  expect(res.status).toBe(200)
  const body = await json<{ ok: true; user: { id: string } }>(res)
  return body.user.id
}

async function postCommand(
  app: ReturnType<typeof createTestApp>,
  cookie: string,
  name: string,
  body: unknown
) {
  return app.request(`/api/commands/${name}`, {
    method: "POST",
    headers: authHeaders(cookie),
    body: JSON.stringify(body),
  })
}

async function createThread(
  app: ReturnType<typeof createTestApp>,
  cookie: string,
  title: string
) {
  const res = await postCommand(app, cookie, THREAD_COMMANDS.create, { title })
  expect(res.status).toBe(200)
  const body = await json<{ ok: true; data: ThreadListItem }>(res)
  return body.data.id
}

async function insertCoachReceipt({
  db,
  threadId,
  parts,
}: {
  db: Awaited<ReturnType<typeof createMigratedTestDb>>["db"]
  threadId: string
  parts: ThreadMessagePart[]
}) {
  const now = new Date()
  const id = createId(now.getTime())
  await db.insert(threadMessages).values({
    id,
    threadId,
    role: "coach",
    text: parts
      .filter((part) => part.type === "text")
      .map((part) => (part.type === "text" ? part.text : ""))
      .join(""),
    parts,
    status: "final",
    createdAt: now,
  })
  return id
}

describe("one-click reversal from Coach receipts", () => {
  let client: Awaited<ReturnType<typeof createMigratedTestDb>>["client"]
  let db: Awaited<ReturnType<typeof createMigratedTestDb>>["db"]
  let app: ReturnType<typeof createTestApp>
  let cookieA: string
  let cookieB: string
  let userIdA: string

  beforeAll(async () => {
    const migrated = await createMigratedTestDb()
    client = migrated.client
    db = migrated.db
    app = createTestApp(db, { coach: createDemoCoachRuntime() })
    cookieA = (await signUp(app, userA)).cookie
    cookieB = (await signUp(app, userB)).cookie
    userIdA = await sessionUserId(app, cookieA)
  }, 60_000)

  afterAll(async () => {
    await client.close()
  })

  it("runs the reversal Command as the User and appends a truthful receipt", async () => {
    const threadId = await createThread(app, cookieA, "Undo create")
    const created = await commandRegistry.execute({
      name: APPLY_COMMANDS.createCard,
      input: { title: "Backend intern", company: "Local startup" },
      actor: { type: "coach", userId: userIdA },
      db,
    })
    const card = successData<ApplyCard>(created)
    expect(created.reversal).toEqual({
      possible: true,
      command: APPLY_COMMANDS.deleteCard,
      description: "Undo by deleting the Apply card.",
      input: { cardId: card.id },
    })

    const messageId = await insertCoachReceipt({
      db,
      threadId,
      parts: [
        { type: "text", text: "Created the card." },
        {
          type: "tool",
          name: "apply_createCard",
          summary: "Created Backend intern at Local startup",
          ok: true,
          toolCallId: "call_create",
          reversal: created.reversal,
        },
      ],
    })

    const asCoach = await commandRegistry.execute({
      name: APPLY_COMMANDS.deleteCard,
      input: { cardId: card.id },
      actor: { type: "coach", userId: userIdA },
      db,
    })
    expect(asCoach.status).toBe(403)
    expect(asCoach.body).toEqual({
      ok: false,
      error: {
        code: ERROR_CODES.COACH_NOT_ALLOWED,
        message: "This Command cannot be run by the Coach",
      },
    })

    const res = await app.request(
      `/api/threads/${threadId}/messages/${messageId}/reverse`,
      {
        method: "POST",
        headers: authHeaders(cookieA),
        body: JSON.stringify({ toolCallId: "call_create" }),
      }
    )
    expect(res.status).toBe(200)
    const body = await json<{ ok: true; data: CoachReverseResult }>(res)
    expect(body.data.receipt).toMatchObject({
      type: "tool",
      name: "apply_deleteCard",
      ok: true,
      summary: expect.any(String),
    })

    const original = body.data.thread.messages
      .find((message) => message.id === messageId)
      ?.parts?.find((part) => part.type === "tool" && part.toolCallId === "call_create")
    expect(original).toMatchObject({ undone: true })
    expect(
      body.data.thread.messages
        .find((message) => message.id === messageId)
        ?.parts?.some(
          (part) =>
            part.type === "tool" &&
            part.ok &&
            part.name === "apply_deleteCard"
        )
    ).toBe(true)

    await expect(
      getOwnedApplyCard(db, userIdA, card.id)
    ).rejects.toMatchObject({ code: ERROR_CODES.NOT_FOUND })
  })

  it("states a failed reversal plainly and leaves the original undo available", async () => {
    const threadId = await createThread(app, cookieA, "Undo missing")
    const created = await commandRegistry.execute({
      name: APPLY_COMMANDS.createCard,
      input: { title: "Gone already", company: "Acme" },
      actor: { type: "user", userId: userIdA },
      db,
    })
    const card = successData<ApplyCard>(created)
    await commandRegistry.execute({
      name: APPLY_COMMANDS.deleteCard,
      input: { cardId: card.id },
      actor: { type: "user", userId: userIdA },
      db,
    })

    const messageId = await insertCoachReceipt({
      db,
      threadId,
      parts: [
        {
          type: "tool",
          name: "apply_createCard",
          summary: "Created Gone already at Acme",
          ok: true,
          toolCallId: "call_missing",
          reversal: created.reversal,
        },
      ],
    })

    const res = await app.request(
      `/api/threads/${threadId}/messages/${messageId}/reverse`,
      {
        method: "POST",
        headers: authHeaders(cookieA),
        body: JSON.stringify({ toolCallId: "call_missing" }),
      }
    )
    expect(res.status).toBe(200)
    const body = await json<{ ok: true; data: CoachReverseResult }>(res)
    expect(body.data.receipt).toMatchObject({
      ok: false,
      summary: "Apply card not found",
    })
    const original = body.data.thread.messages
      .find((message) => message.id === messageId)
      ?.parts?.find(
        (part) => part.type === "tool" && part.toolCallId === "call_missing"
      )
    expect(original).toBeDefined()
    expect(original).not.toHaveProperty("undone")
  })

  it("keeps receipts with reversal.possible === false read-only", async () => {
    const threadId = await createThread(app, cookieA, "Read only")
    const messageId = await insertCoachReceipt({
      db,
      threadId,
      parts: [
        {
          type: "tool",
          name: "apply_listCards",
          summary: "Listed 1 Apply card",
          ok: true,
          toolCallId: "call_read",
          reversal: {
            possible: false,
            description: "This read does not change anything.",
          },
        },
      ],
    })

    const res = await app.request(
      `/api/threads/${threadId}/messages/${messageId}/reverse`,
      {
        method: "POST",
        headers: authHeaders(cookieA),
        body: JSON.stringify({ toolCallId: "call_read" }),
      }
    )
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({
      ok: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: "This receipt cannot be undone",
      },
    })
  })

  it("forbids another User from reversing a receipt", async () => {
    const threadId = await createThread(app, cookieA, "Private undo")
    const messageId = await insertCoachReceipt({
      db,
      threadId,
      parts: [
        {
          type: "tool",
          name: "apply_toggleStar",
          summary: "Starred a card",
          ok: true,
          toolCallId: "call_star",
          reversal: {
            possible: true,
            command: APPLY_COMMANDS.toggleStar,
            description: "Undo by toggling the star again.",
            input: { cardId: "11111111-1111-4111-8111-111111111111" },
          },
        },
      ],
    })

    const res = await app.request(
      `/api/threads/${threadId}/messages/${messageId}/reverse`,
      {
        method: "POST",
        headers: authHeaders(cookieB),
        body: JSON.stringify({ toolCallId: "call_star" }),
      }
    )
    expect(res.status).toBe(403)
  })

  it("returns 401 without a session", async () => {
    const res = await app.request(
      "/api/threads/11111111-1111-4111-8111-111111111111/messages/22222222-2222-4222-8222-222222222222/reverse",
      {
        method: "POST",
        body: JSON.stringify({ toolCallId: "call_1" }),
      }
    )
    expect(res.status).toBe(401)
  })

  it("returns 503 AUTH_UNAVAILABLE when the app has no database", async () => {
    const bare = createApp({ webOrigins: [] })
    const res = await bare.request(
      "/api/threads/11111111-1111-4111-8111-111111111111/messages/22222222-2222-4222-8222-222222222222/reverse",
      {
        method: "POST",
        body: JSON.stringify({ toolCallId: "call_1" }),
      }
    )
    expect(res.status).toBe(503)
  })
})
