import {
  ERROR_CODES,
  textFromParts,
  type ThreadDetail,
  type ThreadMessagePart,
} from "@workspace/domain"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { threadMessages } from "../db/schema.js"
import { createId } from "../id.js"
import {
  authHeaders,
  createMigratedTestDb,
  createTestApp,
  signUp,
} from "../test/harness.js"
import { toThreadMessage } from "./queries.js"

const user = {
  name: "Minh",
  email: "minh-coach-fields@example.com",
  password: "correct-horse-battery",
}

describe("textFromParts", () => {
  it("concatenates text parts in order and ignores tool receipts", () => {
    const parts: ThreadMessagePart[] = [
      { type: "text", text: "Moved it. " },
      {
        type: "tool",
        name: "apply.moveCard",
        summary: "Moved 'Backend Intern' to Prep",
        ok: true,
      },
      { type: "text", text: "That's the one next step." },
    ]

    expect(textFromParts(parts)).toBe("Moved it. That's the one next step.")
  })
})

describe("toThreadMessage", () => {
  it("omits optional coach fields when they are null so old rows stay unchanged", () => {
    expect(
      toThreadMessage({
        id: "m1",
        role: "coach",
        text: "Hello",
        createdAt: new Date("2026-08-25T00:00:00.000Z"),
        parts: null,
        status: null,
        workedMs: null,
      })
    ).toEqual({
      id: "m1",
      role: "coach",
      text: "Hello",
      createdAt: "2026-08-25T00:00:00.000Z",
    })
  })

  it("includes parts, status, and workedMs when present", () => {
    const parts: ThreadMessagePart[] = [{ type: "text", text: "Done." }]
    expect(
      toThreadMessage({
        id: "m2",
        role: "coach",
        text: "Done.",
        createdAt: new Date("2026-08-25T00:00:01.000Z"),
        parts,
        status: "final",
        workedMs: 1400,
      })
    ).toEqual({
      id: "m2",
      role: "coach",
      text: "Done.",
      createdAt: "2026-08-25T00:00:01.000Z",
      parts,
      status: "final",
      workedMs: 1400,
    })
  })
})

describe("thread detail optional coach fields", () => {
  let client: Awaited<ReturnType<typeof createMigratedTestDb>>["client"]
  let db: Awaited<ReturnType<typeof createMigratedTestDb>>["db"]
  let app: ReturnType<typeof createTestApp>
  let cookie: string

  beforeAll(async () => {
    const migrated = await createMigratedTestDb()
    client = migrated.client
    db = migrated.db
    app = createTestApp(db)
    cookie = (await signUp(app, user)).cookie
  }, 60_000)

  afterAll(async () => {
    await client.close()
  })

  it("keeps stub rows as plain text and returns rich fields when stored", async () => {
    const created = await app.request("/api/commands/threads.create", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ title: "Coach fields" }),
    })
    expect(created.status).toBe(200)
    const createdBody = (await created.json()) as {
      ok: true
      data: { id: string }
    }
    const threadId = createdBody.data.id

    const posted = await app.request("/api/commands/threads.postMessage", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ threadId, text: "Should I finish my CV first?" }),
    })
    expect(posted.status).toBe(200)
    const postedBody = (await posted.json()) as { ok: true; data: ThreadDetail }
    expect(postedBody.data.messages).toHaveLength(1)
    expect(postedBody.data.messages[0]).toEqual(
      expect.objectContaining({
        role: "user",
        text: "Should I finish my CV first?",
      })
    )
    expect(postedBody.data.messages[0]).not.toHaveProperty("parts")
    expect(postedBody.data.messages[0]).not.toHaveProperty("status")
    expect(postedBody.data.messages[0]).not.toHaveProperty("workedMs")

    const parts: ThreadMessagePart[] = [
      { type: "text", text: "I moved the card. " },
      {
        type: "tool",
        name: "apply.moveCard",
        summary: "Moved 'Backend Intern' to Prep",
        ok: true,
        reversal: {
          possible: true,
          description: "Undo by moving the card back.",
          command: "apply.moveCard",
        },
      },
      { type: "text", text: "Prep is the next step." },
    ]
    const richId = createId()
    await db.insert(threadMessages).values({
      id: richId,
      threadId,
      role: "coach",
      text: textFromParts(parts),
      parts,
      status: "final",
      workedMs: 2100,
      createdAt: new Date(),
    })

    const detailRes = await app.request(`/api/threads/${threadId}`, {
      headers: authHeaders(cookie),
    })
    expect(detailRes.status).toBe(200)
    const detail = (await detailRes.json()) as { ok: true; data: ThreadDetail }
    const rich = detail.data.messages.find((message) => message.id === richId)
    expect(rich).toEqual({
      id: richId,
      role: "coach",
      text: "I moved the card. Prep is the next step.",
      createdAt: expect.any(String),
      parts,
      status: "final",
      workedMs: 2100,
    })
  })

  it("still 404s an unknown thread after the new columns exist", async () => {
    const missing = await app.request(
      "/api/threads/11111111-1111-4111-8111-111111111111",
      { headers: authHeaders(cookie) }
    )
    expect(missing.status).toBe(404)
    await expect(missing.json()).resolves.toEqual({
      ok: false,
      error: { code: ERROR_CODES.NOT_FOUND, message: "Thread not found" },
    })
  })
})
