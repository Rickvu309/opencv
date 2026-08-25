import {
  ERROR_CODES,
  THREAD_COMMANDS,
  type ThreadDetail,
  type ThreadListItem,
} from "@workspace/domain"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import {
  authHeaders,
  createMigratedTestDb,
  createTestApp,
  signUp,
} from "../test/harness.js"

const userA = {
  name: "Minh",
  email: "minh-threads@example.com",
  password: "correct-horse-battery",
}
const userB = {
  name: "Lan",
  email: "lan-threads@example.com",
  password: "correct-horse-battery",
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

async function json<T>(res: Response): Promise<T> {
  return (await res.json()) as T
}

describe("threads API", () => {
  let client: Awaited<ReturnType<typeof createMigratedTestDb>>["client"]
  let app: ReturnType<typeof createTestApp>
  let cookieA: string
  let cookieB: string

  beforeAll(async () => {
    const migrated = await createMigratedTestDb()
    client = migrated.client
    app = createTestApp(migrated.db)
    cookieA = (await signUp(app, userA)).cookie
    cookieB = (await signUp(app, userB)).cookie
  }, 60_000)

  afterAll(async () => {
    await client.close()
  })

  it("requires a session on reads and mutations", async () => {
    const list = await app.request("/api/threads")
    expect(list.status).toBe(401)
    await expect(list.json()).resolves.toEqual({
      ok: false,
      error: {
        code: ERROR_CODES.UNAUTHORIZED,
        message: "Authentication required",
      },
    })

    const command = await app.request(
      `/api/commands/${THREAD_COMMANDS.create}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }
    )
    expect(command.status).toBe(401)
  })

  it("does not expose a write path besides POST /api/commands/:name", async () => {
    const create = await app.request("/api/threads", {
      method: "POST",
      headers: authHeaders(cookieA),
      body: JSON.stringify({ title: "nope" }),
    })
    expect(create.status).toBe(404)

    const remove = await app.request("/api/threads/not-a-route", {
      method: "DELETE",
      headers: authHeaders(cookieA),
    })
    expect(remove.status).toBe(404)
  })

  it("round-trips a conversation: create, post, list, read, rename, delete", async () => {
    const createdRes = await postCommand(app, cookieA, THREAD_COMMANDS.create, {
      title: "CV vs internship first",
    })
    expect(createdRes.status).toBe(200)
    const created = await json<{ ok: true; data: ThreadListItem }>(createdRes)
    expect(created).toEqual({
      ok: true,
      data: expect.objectContaining({
        id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        title: "CV vs internship first",
      }),
    })
    const threadId = created.data.id

    const postedRes = await postCommand(
      app,
      cookieA,
      THREAD_COMMANDS.postMessage,
      { threadId, text: "Should I finish my CV first?" }
    )
    expect(postedRes.status).toBe(200)
    const posted = await json<{ ok: true; data: ThreadDetail }>(postedRes)
    expect(posted.data.messages).toEqual([
      expect.objectContaining({
        role: "user",
        text: "Should I finish my CV first?",
      }),
    ])

    const second = await postCommand(app, cookieA, THREAD_COMMANDS.create, {
      title: "Older then newer",
    })
    expect(second.status).toBe(200)
    const secondId = (await json<{ ok: true; data: ThreadListItem }>(second))
      .data.id

    await new Promise((resolve) => setTimeout(resolve, 10))
    const bump = await postCommand(app, cookieA, THREAD_COMMANDS.postMessage, {
      threadId,
      text: "Still thinking.",
    })
    expect(bump.status).toBe(200)

    const listRes = await app.request("/api/threads", {
      headers: authHeaders(cookieA),
    })
    expect(listRes.status).toBe(200)
    const list = await json<{ ok: true; data: ThreadListItem[] }>(listRes)
    expect(list.data.map((thread) => thread.id).slice(0, 2)).toEqual([
      threadId,
      secondId,
    ])
    expect(list.data.length).toBeGreaterThanOrEqual(2)

    const detailRes = await app.request(`/api/threads/${threadId}`, {
      headers: authHeaders(cookieA),
    })
    expect(detailRes.status).toBe(200)
    const detail = await json<{ ok: true; data: ThreadDetail }>(detailRes)
    expect(detail.data.messages).toHaveLength(2)
    expect(detail.data.messages[1]).toEqual(
      expect.objectContaining({ role: "user", text: "Still thinking." })
    )

    const renamedRes = await postCommand(app, cookieA, THREAD_COMMANDS.rename, {
      threadId,
      title: "Plan the week",
    })
    expect(renamedRes.status).toBe(200)
    const renamed = await json<{ ok: true; data: ThreadListItem }>(renamedRes)
    expect(renamed.data.title).toBe("Plan the week")

    const deletedRes = await postCommand(app, cookieA, THREAD_COMMANDS.delete, {
      threadId: secondId,
    })
    expect(deletedRes.status).toBe(200)
    await expect(deletedRes.json()).resolves.toEqual({
      ok: true,
      data: { id: secondId },
    })

    const afterDelete = await app.request(`/api/threads/${secondId}`, {
      headers: authHeaders(cookieA),
    })
    expect(afterDelete.status).toBe(404)
    await expect(afterDelete.json()).resolves.toEqual({
      ok: false,
      error: { code: ERROR_CODES.NOT_FOUND, message: "Thread not found" },
    })
  })

  it("keeps user B off user A's threads", async () => {
    const createdRes = await postCommand(app, cookieA, THREAD_COMMANDS.create, {
      title: "A only",
    })
    const threadId = (
      await json<{ ok: true; data: ThreadListItem }>(createdRes)
    ).data.id

    const listB = await app.request("/api/threads", {
      headers: authHeaders(cookieB),
    })
    const listed = await json<{ ok: true; data: ThreadListItem[] }>(listB)
    expect(listed.data.map((thread) => thread.id)).not.toContain(threadId)

    const readB = await app.request(`/api/threads/${threadId}`, {
      headers: authHeaders(cookieB),
    })
    expect(readB.status).toBe(403)
    await expect(readB.json()).resolves.toEqual({
      ok: false,
      error: {
        code: ERROR_CODES.FORBIDDEN,
        message: "You cannot access this Thread",
      },
    })

    const mutateB = await postCommand(app, cookieB, THREAD_COMMANDS.rename, {
      threadId,
      title: "stolen",
    })
    expect(mutateB.status).toBe(403)
    await expect(mutateB.json()).resolves.toEqual({
      ok: false,
      error: {
        code: ERROR_CODES.FORBIDDEN,
        message: "You cannot access this Thread",
      },
    })
  })

  it("returns the documented envelopes for unknown command and bad input", async () => {
    const unknown = await postCommand(app, cookieA, "threads.explode", {})
    expect(unknown.status).toBe(404)
    await expect(unknown.json()).resolves.toEqual({
      ok: false,
      error: { code: ERROR_CODES.UNKNOWN_COMMAND, message: "Unknown command" },
    })

    const bad = await postCommand(app, cookieA, THREAD_COMMANDS.postMessage, {
      threadId: "nope",
      text: "",
    })
    expect(bad.status).toBe(400)
    const body = await json<{ ok: false; error: { code: string } }>(bad)
    expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR)
  })
})
