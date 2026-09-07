import { execFile } from "node:child_process"
import { promisify } from "node:util"

import { serve } from "@hono/node-server"
import type { ServerType } from "@hono/node-server"
import {
  COACH_SSE_EVENTS,
  DEFAULT_COACH_MODEL_FREE,
  DEFAULT_COACH_MODEL_LIGHT,
  DEFAULT_COACH_MODEL_MAX,
  DEFAULT_THREAD_TITLE,
  ERROR_CODES,
  PROFILE_COMMANDS,
  PAPER_COMMANDS,
  THREAD_COMMANDS,
  deterministicThreadTitle,
  titleFrom,
  type CoachTurnInput,
  type ThreadDetail,
  type ThreadListItem,
  type ThreadMessage,
} from "@workspace/domain"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { createApp } from "../app.js"
import { coachUsage } from "../db/schema.js"
import {
  authHeaders,
  createMigratedTestDb,
  createTestApp,
  signUp,
  testWebOrigin,
} from "../test/harness.js"
import {
  createDemoCoachRuntime,
  createScriptedCoachRuntime,
  createThrowingCoachRuntime,
  DEMO_COACH_SCRIPT,
  withTitleGenerator,
} from "./fake.js"

const execFileAsync = promisify(execFile)

const userA = {
  name: "Minh",
  email: "minh-coach-route@example.com",
  password: "correct-horse-battery",
}
const userB = {
  name: "Lan",
  email: "lan-coach-route@example.com",
  password: "correct-horse-battery",
}

type SseEvent = { event: string; data: unknown }

function parseSseEvents(raw: string): SseEvent[] {
  const events: SseEvent[] = []
  for (const block of raw.split(/\r?\n\r?\n/)) {
    const lines = block.split(/\r?\n/).filter((line) => line.length > 0)
    if (lines.length === 0 || lines.every((line) => line.startsWith(":"))) {
      continue
    }
    let event = "message"
    const dataLines: string[] = []
    for (const line of lines) {
      if (line.startsWith(":")) continue
      if (line.startsWith("event:")) event = line.slice("event:".length).trim()
      else if (line.startsWith("data:")) {
        dataLines.push(line.slice("data:".length).trimStart())
      }
    }
    if (dataLines.length === 0) continue
    events.push({ event, data: JSON.parse(dataLines.join("\n")) })
  }
  return events
}

async function json<T>(res: Response): Promise<T> {
  return (await res.json()) as T
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

async function postCoach(
  app: ReturnType<typeof createTestApp>,
  cookie: string,
  threadId: string,
  text: string,
  init?: RequestInit,
  mode?: "free" | "light" | "max"
) {
  return app.request(`/api/threads/${threadId}/coach`, {
    method: "POST",
    headers: authHeaders(cookie),
    body: JSON.stringify(mode ? { text, mode } : { text }),
    ...init,
  })
}

async function listen(app: ReturnType<typeof createApp>) {
  const server = await new Promise<ServerType>((resolve) => {
    const started = serve(
      { fetch: app.fetch, hostname: "127.0.0.1", port: 0 },
      () => resolve(started)
    )
  })
  const address = server.address()
  if (!address || typeof address === "string") {
    throw new Error("expected a TCP address")
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    async close() {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      })
    },
  }
}

describe("coach route guards", () => {
  let client: Awaited<ReturnType<typeof createMigratedTestDb>>["client"]
  let db: Awaited<ReturnType<typeof createMigratedTestDb>>["db"]
  let cookieA: string
  let cookieB: string
  let threadId: string

  beforeAll(async () => {
    const migrated = await createMigratedTestDb()
    client = migrated.client
    db = migrated.db
    const app = createTestApp(db, { coach: createDemoCoachRuntime() })
    cookieA = (await signUp(app, userA)).cookie
    cookieB = (await signUp(app, userB)).cookie
    threadId = await createThread(app, cookieA, "Guards")
  }, 60_000)

  afterAll(async () => {
    await client.close()
  })

  it("returns 503 COACH_UNAVAILABLE without a runtime", async () => {
    const app = createTestApp(db)
    const res = await postCoach(app, cookieA, threadId, "Hello")
    expect(res.status).toBe(503)
    await expect(res.json()).resolves.toEqual({
      ok: false,
      error: {
        code: ERROR_CODES.COACH_UNAVAILABLE,
        message: "The Coach is unavailable right now",
      },
    })
  })

  it("returns 503 AUTH_UNAVAILABLE when the app has no database", async () => {
    const app = createApp({ webOrigins: [] })
    const res = await app.request(
      "/api/threads/11111111-1111-4111-8111-111111111111/coach",
      { method: "POST", body: JSON.stringify({ text: "Hello" }) }
    )
    expect(res.status).toBe(503)
    await expect(res.json()).resolves.toEqual({
      ok: false,
      error: {
        code: "AUTH_UNAVAILABLE",
        message: "Authentication is not configured",
      },
    })
  })

  it("returns 401 without a session", async () => {
    const app = createTestApp(db, { coach: createDemoCoachRuntime() })
    const res = await app.request(`/api/threads/${threadId}/coach`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Hello" }),
    })
    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toEqual({
      ok: false,
      error: {
        code: ERROR_CODES.UNAUTHORIZED,
        message: "Authentication required",
      },
    })
  })

  it("returns 403 when another user does not own the Thread", async () => {
    const app = createTestApp(db, { coach: createDemoCoachRuntime() })
    const res = await postCoach(app, cookieB, threadId, "stolen")
    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({
      ok: false,
      error: {
        code: ERROR_CODES.FORBIDDEN,
        message: "You cannot access this Thread",
      },
    })
  })

  it("returns a plain 429 envelope at the daily turn cap", async () => {
    const app = createTestApp(db, {
      coach: createDemoCoachRuntime(),
      coachDailyTurnLimit: 1,
    })
    const cappedId = await createThread(app, cookieA, "Cap")
    const first = await postCoach(app, cookieA, cappedId, "first turn")
    expect(first.status).toBe(200)
    await first.text()

    const second = await postCoach(app, cookieA, cappedId, "second turn")
    expect(second.status).toBe(429)
    await expect(second.json()).resolves.toEqual({
      ok: false,
      error: {
        code: ERROR_CODES.COACH_LIMIT_REACHED,
        message: "You've reached today's Coach turn limit",
      },
    })

    const detail = await json<{ ok: true; data: ThreadDetail }>(
      await createTestApp(db).request(`/api/threads/${cappedId}`, {
        headers: authHeaders(cookieA),
      })
    )
    expect(detail.data.messages.map((message) => message.text)).toEqual([
      "first turn",
      "I looked at Apply. Prep the starred one next.",
    ])
  })
})

describe("coach route scripted fake", () => {
  let client: Awaited<ReturnType<typeof createMigratedTestDb>>["client"]
  let db: Awaited<ReturnType<typeof createMigratedTestDb>>["db"]
  let cookie: string

  beforeAll(async () => {
    const migrated = await createMigratedTestDb()
    client = migrated.client
    db = migrated.db
    const app = createTestApp(db, { coach: createDemoCoachRuntime() })
    cookie = (await signUp(app, userA)).cookie
  }, 60_000)

  afterAll(async () => {
    await client.close()
  })

  it("streams the owned event order and payloads, then persists the coach row and usage", async () => {
    const app = createTestApp(db, { coach: createDemoCoachRuntime() })
    const threadId = await createThread(app, cookie, "Happy path")

    const res = await postCoach(app, cookie, threadId, "Help me plan the week")
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("text/event-stream")
    expect(res.headers.get("x-accel-buffering")).toBe("no")
    expect(res.headers.get("content-encoding")).toBe("identity")

    const raw = await res.text()
    const events = parseSseEvents(raw)
    expect(events.map((event) => event.event)).toEqual([
      COACH_SSE_EVENTS.messageStart,
      COACH_SSE_EVENTS.textDelta,
      COACH_SSE_EVENTS.toolCall,
      COACH_SSE_EVENTS.toolResult,
      COACH_SSE_EVENTS.textDelta,
      COACH_SSE_EVENTS.messageEnd,
    ])
    expect(events[0]?.data).toEqual({ threadId })
    expect(events[1]?.data).toEqual({ text: "I looked at Apply. " })
    expect(events[2]?.data).toEqual({
      toolCallId: "call_1",
      name: "apply_listCards",
      input: {},
    })
    expect(events[3]?.data).toEqual({
      toolCallId: "call_1",
      name: "apply_listCards",
      summary: "Listed your Apply cards",
      ok: true,
      reversal: {
        possible: false,
        description: "Listing cards does not change anything.",
      },
      result: { ok: true, data: [] },
    })
    expect(events[4]?.data).toEqual({ text: "Prep the starred one next." })

    const ended = events[5]?.data as {
      message: ThreadMessage
      usage: { model: string; tokens?: number; finishReason?: string }
    }
    expect(ended.message).toEqual(
      expect.objectContaining({
        role: "coach",
        text: "I looked at Apply. Prep the starred one next.",
        status: "final",
        rating: null,
        parts: [
          { type: "text", text: "I looked at Apply. " },
          {
            type: "tool",
            name: "apply_listCards",
            summary: "Listed your Apply cards",
            ok: true,
            reversal: {
              possible: false,
              description: "Listing cards does not change anything.",
            },
            toolCallId: "call_1",
          },
          { type: "text", text: "Prep the starred one next." },
        ],
      })
    )
    expect(ended.message.workedMs).toBeGreaterThanOrEqual(0)
    expect(ended.usage).toEqual(
      expect.objectContaining({
        model: DEFAULT_COACH_MODEL_FREE,
        tokens: 42,
        finishReason: "stop",
      })
    )

    const detail = await json<{ ok: true; data: ThreadDetail }>(
      await app.request(`/api/threads/${threadId}`, {
        headers: authHeaders(cookie),
      })
    )
    expect(detail.data.messages).toEqual([
      expect.objectContaining({
        role: "user",
        text: "Help me plan the week",
      }),
      ended.message,
    ])

    const usageRows = await db
      .select()
      .from(coachUsage)
      .where(eq(coachUsage.threadId, threadId))
    expect(usageRows).toHaveLength(1)
    expect(usageRows[0]).toEqual(
      expect.objectContaining({
        threadId,
        messageId: ended.message.id,
        model: DEFAULT_COACH_MODEL_FREE,
        mode: "free",
        tokens: 42,
        finishReason: "stop",
      })
    )
  })

  it("commits the user row even when the runtime throws, and persists an error coach row", async () => {
    const app = createTestApp(db, {
      coach: createThrowingCoachRuntime(new Error("model exploded")),
    })
    const threadId = await createThread(app, cookie, "Throw")

    const res = await postCoach(app, cookie, threadId, "Still send this")
    expect(res.status).toBe(200)
    const events = parseSseEvents(await res.text())
    expect(events.map((event) => event.event)).toEqual([
      COACH_SSE_EVENTS.messageStart,
      COACH_SSE_EVENTS.error,
      COACH_SSE_EVENTS.messageEnd,
    ])
    expect(events[1]?.data).toEqual({ message: "model exploded" })

    const ended = events[2]?.data as { message: ThreadMessage }
    expect(ended.message).toEqual(
      expect.objectContaining({
        role: "coach",
        text: "",
        status: "error",
        parts: [],
      })
    )

    const detail = await json<{ ok: true; data: ThreadDetail }>(
      await app.request(`/api/threads/${threadId}`, {
        headers: authHeaders(cookie),
      })
    )
    expect(detail.data.messages[0]).toEqual(
      expect.objectContaining({ role: "user", text: "Still send this" })
    )
    expect(detail.data.messages[1]?.status).toBe("error")

    const usageRows = await db
      .select()
      .from(coachUsage)
      .where(eq(coachUsage.messageId, ended.message.id))
    expect(usageRows).toHaveLength(1)
    expect(usageRows[0]?.finishReason).toBe("error")
  })

  it("rewrites a dead-model throw into Light-mode copy on Free", async () => {
    const app = createTestApp(db, {
      coach: createThrowingCoachRuntime(
        new Error("No endpoints found for retired/dead-model.")
      ),
    })
    const threadId = await createThread(app, cookie, "Dead model")

    const res = await postCoach(
      app,
      cookie,
      threadId,
      "Still send this",
      undefined,
      "free"
    )
    expect(res.status).toBe(200)
    const events = parseSseEvents(await res.text())
    expect(events[1]?.data).toEqual({
      message: "The free Coach model isn't available right now. Try Light mode.",
    })
    expect(JSON.stringify(events[1]?.data)).not.toMatch(
      /No endpoints|retired\/dead-model/
    )
  })

  it("writes a heartbeat comment while the runtime is working", async () => {
    const app = createTestApp(db, {
      coach: createScriptedCoachRuntime(async function* () {
        await new Promise((resolve) => setTimeout(resolve, 50))
        yield { type: "text-delta", text: "Hi" }
        yield {
          type: "finish",
          finishReason: "stop",
          usage: { model: DEFAULT_COACH_MODEL_FREE },
        }
      }),
      coachSseHeartbeatMs: 15,
    })
    const threadId = await createThread(app, cookie, "Heartbeat")
    const raw = await (await postCoach(app, cookie, threadId, "ping")).text()
    expect(raw).toContain(": heartbeat")
    expect(parseSseEvents(raw).map((event) => event.event)).toEqual([
      COACH_SSE_EVENTS.messageStart,
      COACH_SSE_EVENTS.textDelta,
      COACH_SSE_EVENTS.messageEnd,
    ])
  })

  it("aborts mid-stream and persists aborted status with accumulated receipts", async () => {
    const hang = createScriptedCoachRuntime(async function* () {
      yield { type: "text-delta", text: "Working. " }
      yield {
        type: "tool-call",
        toolCallId: "t1",
        name: "apply_moveCard",
        input: {},
      }
      yield {
        type: "tool-result",
        toolCallId: "t1",
        name: "apply_moveCard",
        summary: "Moved the card",
        ok: true,
        reversal: {
          possible: true,
          description: "Undo by moving the card back.",
          command: "apply.moveCard",
        },
        result: { ok: true, data: { id: "c1" } },
      }
      await new Promise<void>(() => {
        // Hold the turn open until the client aborts.
      })
    })
    const app = createTestApp(db, { coach: hang })
    const threadId = await createThread(app, cookie, "Abort")
    const { url, close } = await listen(app)

    try {
      const controller = new AbortController()
      const res = await fetch(`${url}/api/threads/${threadId}/coach`, {
        method: "POST",
        headers: authHeaders(cookie),
        body: JSON.stringify({ text: "Move it" }),
        signal: controller.signal,
      })
      expect(res.body).not.toBeNull()
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buf = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        if (buf.includes("event: tool-result")) {
          controller.abort()
          break
        }
      }

      let detail: ThreadDetail | undefined
      for (let attempt = 0; attempt < 40; attempt += 1) {
        const loaded = await json<{ ok: true; data: ThreadDetail }>(
          await app.request(`/api/threads/${threadId}`, {
            headers: authHeaders(cookie),
          })
        )
        if (loaded.data.messages.some((message) => message.role === "coach")) {
          detail = loaded.data
          break
        }
        await new Promise((resolve) => setTimeout(resolve, 25))
      }

      expect(detail?.messages[0]).toEqual(
        expect.objectContaining({ role: "user", text: "Move it" })
      )
      expect(detail?.messages[1]).toEqual(
        expect.objectContaining({
          role: "coach",
          status: "aborted",
          text: "Working. ",
          parts: [
            { type: "text", text: "Working. " },
            {
              type: "tool",
              name: "apply_moveCard",
              summary: "Moved the card",
              ok: true,
              reversal: {
                possible: true,
                description: "Undo by moving the card back.",
                command: "apply.moveCard",
              },
              toolCallId: "t1",
            },
          ],
        })
      )

      const usageRows = await db
        .select()
        .from(coachUsage)
        .where(eq(coachUsage.threadId, threadId))
      expect(usageRows[0]?.finishReason).toBe("aborted")
    } finally {
      await close()
    }
  })
})

describe("coach feedback", () => {
  let client: Awaited<ReturnType<typeof createMigratedTestDb>>["client"]
  let db: Awaited<ReturnType<typeof createMigratedTestDb>>["db"]
  let cookieA: string
  let cookieB: string

  beforeAll(async () => {
    const migrated = await createMigratedTestDb()
    client = migrated.client
    db = migrated.db
    const app = createTestApp(db, { coach: createDemoCoachRuntime() })
    cookieA = (await signUp(app, userA)).cookie
    cookieB = (await signUp(app, userB)).cookie
  }, 60_000)

  afterAll(async () => {
    await client.close()
  })

  async function finishTurn(title: string) {
    const app = createTestApp(db, { coach: createDemoCoachRuntime() })
    const threadId = await createThread(app, cookieA, title)
    const res = await postCoach(app, cookieA, threadId, "Rate this")
    const events = parseSseEvents(await res.text())
    const ended = events.find((event) => event.event === COACH_SSE_EVENTS.messageEnd)
      ?.data as { message: ThreadMessage }
    return { app, threadId, messageId: ended.message.id }
  }

  it("records a rating on the usage row and returns it on reload", async () => {
    const { app, threadId, messageId } = await finishTurn("Feedback")

    const posted = await app.request(
      `/api/threads/${threadId}/messages/${messageId}/feedback`,
      {
        method: "POST",
        headers: authHeaders(cookieA),
        body: JSON.stringify({ rating: "up" }),
      }
    )
    expect(posted.status).toBe(200)
    await expect(posted.json()).resolves.toEqual({
      ok: true,
      data: { messageId, rating: "up" },
    })

    const usageRows = await db
      .select()
      .from(coachUsage)
      .where(eq(coachUsage.messageId, messageId))
    expect(usageRows[0]?.rating).toBe("up")

    const detail = await json<{ ok: true; data: ThreadDetail }>(
      await app.request(`/api/threads/${threadId}`, {
        headers: authHeaders(cookieA),
      })
    )
    const coach = detail.data.messages.find((message) => message.id === messageId)
    expect(coach?.rating).toBe("up")

    const changed = await app.request(
      `/api/threads/${threadId}/messages/${messageId}/feedback`,
      {
        method: "POST",
        headers: authHeaders(cookieA),
        body: JSON.stringify({ rating: "down" }),
      }
    )
    expect(changed.status).toBe(200)
    const reloaded = await json<{ ok: true; data: ThreadDetail }>(
      await app.request(`/api/threads/${threadId}`, {
        headers: authHeaders(cookieA),
      })
    )
    expect(
      reloaded.data.messages.find((message) => message.id === messageId)?.rating
    ).toBe("down")
  })

  it("rejects invalid ratings, missing turns, and other users", async () => {
    const { app, threadId, messageId } = await finishTurn("Feedback guards")

    const invalid = await app.request(
      `/api/threads/${threadId}/messages/${messageId}/feedback`,
      {
        method: "POST",
        headers: authHeaders(cookieA),
        body: JSON.stringify({ rating: "meh" }),
      }
    )
    expect(invalid.status).toBe(400)

    const missing = await app.request(
      `/api/threads/${threadId}/messages/11111111-1111-4111-8111-111111111111/feedback`,
      {
        method: "POST",
        headers: authHeaders(cookieA),
        body: JSON.stringify({ rating: "up" }),
      }
    )
    expect(missing.status).toBe(404)

    const stolen = await app.request(
      `/api/threads/${threadId}/messages/${messageId}/feedback`,
      {
        method: "POST",
        headers: authHeaders(cookieB),
        body: JSON.stringify({ rating: "up" }),
      }
    )
    expect(stolen.status).toBe(403)

    const unauthed = await app.request(
      `/api/threads/${threadId}/messages/${messageId}/feedback`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: "up" }),
      }
    )
    expect(unauthed.status).toBe(401)
  })

  it("does not require a Coach runtime to record feedback", async () => {
    const seeded = await finishTurn("No runtime")
    const app = createTestApp(db)
    const posted = await app.request(
      `/api/threads/${seeded.threadId}/messages/${seeded.messageId}/feedback`,
      {
        method: "POST",
        headers: authHeaders(cookieA),
        body: JSON.stringify({ rating: "down" }),
      }
    )
    expect(posted.status).toBe(200)
    await expect(posted.json()).resolves.toEqual({
      ok: true,
      data: { messageId: seeded.messageId, rating: "down" },
    })
  })
})

describe("coach route curl -N", () => {
  let client: Awaited<ReturnType<typeof createMigratedTestDb>>["client"]
  let close: (() => Promise<void>) | undefined

  afterAll(async () => {
    await close?.()
    await client.close()
  })

  it("shows the full event sequence through curl -N against the fake", async () => {
    const migrated = await createMigratedTestDb()
    client = migrated.client
    const app = createTestApp(migrated.db, { coach: createDemoCoachRuntime() })
    const cookie = (await signUp(app, userA)).cookie
    const threadId = await createThread(app, cookie, "Curl")
    const server = await listen(app)
    close = server.close

    const { stdout } = await execFileAsync("curl", [
      "-N",
      "-sS",
      "-X",
      "POST",
      `${server.url}/api/threads/${threadId}/coach`,
      "-H",
      `Origin: ${testWebOrigin}`,
      "-H",
      "Content-Type: application/json",
      "-H",
      `Cookie: ${cookie}`,
      "--data",
      JSON.stringify({ text: "Help me plan the week" }),
    ])

    const events = parseSseEvents(stdout)
    expect(events.map((event) => event.event)).toEqual([
      COACH_SSE_EVENTS.messageStart,
      COACH_SSE_EVENTS.textDelta,
      COACH_SSE_EVENTS.toolCall,
      COACH_SSE_EVENTS.toolResult,
      COACH_SSE_EVENTS.textDelta,
      COACH_SSE_EVENTS.messageEnd,
    ])
    expect(DEMO_COACH_SCRIPT.map((part) => part.type)).toContain("finish")
  }, 20_000)
})

describe("coach route modes", () => {
  let client: Awaited<ReturnType<typeof createMigratedTestDb>>["client"]
  let db: Awaited<ReturnType<typeof createMigratedTestDb>>["db"]
  let cookie: string

  beforeAll(async () => {
    const migrated = await createMigratedTestDb()
    client = migrated.client
    db = migrated.db
    const app = createTestApp(db, { coach: createDemoCoachRuntime() })
    cookie = (await signUp(app, {
      name: "Mode",
      email: "mode-coach-route@example.com",
      password: "correct-horse-battery",
    })).cookie
  }, 60_000)

  afterAll(async () => {
    await client.close()
  })

  it("rejects an invalid mode before calling the runtime", async () => {
    const app = createTestApp(db, { coach: createDemoCoachRuntime() })
    const threadId = await createThread(app, cookie, "Invalid mode")
    const res = await app.request(`/api/threads/${threadId}/coach`, {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ text: "Hello", mode: "ultra" }),
    })
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({
      ok: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: expect.stringMatching(/invalid/i),
      },
    })
  })

  it("records the resolved model and mode for Free, Light, and Max", async () => {
    const app = createTestApp(db, { coach: createDemoCoachRuntime() })
    const expected = {
      free: DEFAULT_COACH_MODEL_FREE,
      light: DEFAULT_COACH_MODEL_LIGHT,
      max: DEFAULT_COACH_MODEL_MAX,
    } as const

    for (const mode of ["free", "light", "max"] as const) {
      const threadId = await createThread(app, cookie, `Mode ${mode}`)
      const res = await postCoach(app, cookie, threadId, `hi ${mode}`, undefined, mode)
      expect(res.status).toBe(200)
      await res.text()

      const usageRows = await db
        .select()
        .from(coachUsage)
        .where(eq(coachUsage.threadId, threadId))
      expect(usageRows).toHaveLength(1)
      expect(usageRows[0]).toEqual(
        expect.objectContaining({
          mode,
          model: expected[mode],
        })
      )
    }
  })

  it("records the free model that answered, not the router slug", async () => {
    const app = createTestApp(db, {
      coach: {
        async *streamTurn() {
          yield { type: "text-delta" as const, text: "Prep the starred card." }
          yield {
            type: "finish" as const,
            finishReason: "stop",
            usage: { model: "z-ai/glm-5.2:free", tokens: 18 },
          }
        },
      },
    })
    const threadId = await createThread(app, cookie, "Resolved free model")
    const res = await postCoach(app, cookie, threadId, "plan my week", undefined, "free")
    expect(res.status).toBe(200)
    await res.text()

    const usageRows = await db
      .select()
      .from(coachUsage)
      .where(eq(coachUsage.threadId, threadId))
    expect(usageRows).toHaveLength(1)
    expect(usageRows[0]).toEqual(
      expect.objectContaining({
        mode: "free",
        model: "z-ai/glm-5.2:free",
      })
    )
    expect(usageRows[0]?.model).not.toBe(DEFAULT_COACH_MODEL_FREE)
  })

  it("uses the saved preference when the request omits mode", async () => {
    const app = createTestApp(db, { coach: createDemoCoachRuntime() })
    const set = await postCommand(app, cookie, PROFILE_COMMANDS.setCoachMode, {
      mode: "max",
    })
    expect(set.status).toBe(200)

    const threadId = await createThread(app, cookie, "Saved mode")
    const res = await postCoach(app, cookie, threadId, "use saved")
    expect(res.status).toBe(200)
    await res.text()

    const usageRows = await db
      .select()
      .from(coachUsage)
      .where(eq(coachUsage.threadId, threadId))
    expect(usageRows[0]).toEqual(
      expect.objectContaining({
        mode: "max",
        model: DEFAULT_COACH_MODEL_MAX,
      })
    )
  })

  it("enforces a per-mode daily turn cap", async () => {
    const app = createTestApp(db, {
      coach: createDemoCoachRuntime(),
      coachDailyTurnLimits: { max: 1 },
    })
    const capped = (
      await signUp(app, {
        name: "Capped",
        email: "mode-cap-coach-route@example.com",
        password: "correct-horse-battery",
      })
    ).cookie
    const threadId = await createThread(app, capped, "Mode cap")
    const first = await postCoach(app, capped, threadId, "first max", undefined, "max")
    expect(first.status).toBe(200)
    await first.text()

    const second = await postCoach(app, capped, threadId, "second max", undefined, "max")
    expect(second.status).toBe(429)

    const light = await postCoach(app, capped, threadId, "still light", undefined, "light")
    expect(light.status).toBe(200)
    await light.text()
  })
})

describe("coach regenerate", () => {
  let client: Awaited<ReturnType<typeof createMigratedTestDb>>["client"]
  let db: Awaited<ReturnType<typeof createMigratedTestDb>>["db"]
  let cookie: string

  beforeAll(async () => {
    const migrated = await createMigratedTestDb()
    client = migrated.client
    db = migrated.db
    const app = createTestApp(db, { coach: createDemoCoachRuntime() })
    cookie = (
      await signUp(app, {
        name: "Regen",
        email: "regen-coach-route@example.com",
        password: "correct-horse-battery",
      })
    ).cookie
  }, 60_000)

  afterAll(async () => {
    await client.close()
  })

  async function postRegenerate(
    app: ReturnType<typeof createTestApp>,
    threadId: string,
    mode?: "free" | "light" | "max"
  ) {
    return app.request(`/api/threads/${threadId}/coach`, {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify(mode ? { regenerate: true, mode } : { regenerate: true }),
    })
  }

  it("rejects regenerate when the Thread has no Coach turn", async () => {
    const app = createTestApp(db, { coach: createDemoCoachRuntime() })
    const threadId = await createThread(app, cookie, "Empty regen")
    const res = await postRegenerate(app, threadId)
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({
      ok: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: "Only the latest Coach turn can be regenerated",
      },
    })
  })

  it("streams a new coach row, keeps the prior turn, and records usage", async () => {
    const seen: CoachTurnInput[] = []
    const app = createTestApp(db, {
      coach: createScriptedCoachRuntime(async function* (input) {
        seen.push(input)
        const text = input.regenerate ? "Trying again." : "First answer."
        yield { type: "text-delta", text }
        yield {
          type: "finish",
          finishReason: "stop",
          usage: { model: "mock", tokens: 11 },
        }
      }),
    })
    const threadId = await createThread(app, cookie, "Regen happy")

    const first = await postCoach(app, cookie, threadId, "Help me plan")
    expect(first.status).toBe(200)
    await first.text()

    const second = await postRegenerate(app, threadId, "light")
    expect(second.status).toBe(200)
    const events = parseSseEvents(await second.text())
    expect(events.map((event) => event.event)).toEqual([
      COACH_SSE_EVENTS.messageStart,
      COACH_SSE_EVENTS.textDelta,
      COACH_SSE_EVENTS.messageEnd,
    ])
    const ended = events[2]?.data as { message: ThreadMessage }
    expect(ended.message).toEqual(
      expect.objectContaining({
        role: "coach",
        text: "Trying again.",
        status: "final",
      })
    )

    expect(seen).toHaveLength(2)
    expect(seen[1]?.regenerate).toBe(true)
    expect(seen[1]?.mode).toBe("light")
    expect(seen[1]?.history.map((message) => message.role)).toEqual([
      "user",
      "coach",
    ])
    expect(seen[1]?.history[0]?.text).toBe("Help me plan")
    expect(seen[1]?.history[1]?.text).toBe("First answer.")

    const detail = await json<{ ok: true; data: ThreadDetail }>(
      await app.request(`/api/threads/${threadId}`, {
        headers: authHeaders(cookie),
      })
    )
    expect(detail.data.messages.map((message) => message.text)).toEqual([
      "Help me plan",
      "First answer.",
      "Trying again.",
    ])
    expect(detail.data.messages[1]?.id).not.toBe(detail.data.messages[2]?.id)

    const usageRows = await db
      .select()
      .from(coachUsage)
      .where(eq(coachUsage.threadId, threadId))
    expect(usageRows).toHaveLength(2)
    expect(usageRows.map((row) => row.mode).sort()).toEqual(["free", "light"])
    expect(
      usageRows.find((row) => row.messageId === ended.message.id)
    ).toEqual(
      expect.objectContaining({
        mode: "light",
        model: DEFAULT_COACH_MODEL_LIGHT,
      })
    )
  })

  it("keeps prior tool receipts and counts regenerate toward the mode cap", async () => {
    const app = createTestApp(db, {
      coach: createScriptedCoachRuntime(async function* (input) {
        if (!input.regenerate) {
          yield { type: "text-delta", text: "Moved it." }
          yield {
            type: "tool-call",
            toolCallId: "t1",
            name: "apply_moveCard",
            input: {},
          }
          yield {
            type: "tool-result",
            toolCallId: "t1",
            name: "apply_moveCard",
            summary: "Moved 'Backend Intern' to Prep",
            ok: true,
            reversal: {
              possible: true,
              description: "Undo by moving the card back.",
              command: "apply.moveCard",
            },
            result: { ok: true, data: { id: "c1" } },
          }
        } else {
          yield { type: "text-delta", text: "Here is another way to look at it." }
        }
        yield {
          type: "finish",
          finishReason: "stop",
          usage: { model: "mock" },
        }
      }),
      coachDailyTurnLimits: { max: 2 },
    })
    const threadId = await createThread(app, cookie, "Regen receipts")

    const first = await postCoach(app, cookie, threadId, "Move it", undefined, "max")
    expect(first.status).toBe(200)
    await first.text()

    const second = await postRegenerate(app, threadId, "max")
    expect(second.status).toBe(200)
    await second.text()

    const third = await postRegenerate(app, threadId, "max")
    expect(third.status).toBe(429)
    await expect(third.json()).resolves.toEqual({
      ok: false,
      error: {
        code: ERROR_CODES.COACH_LIMIT_REACHED,
        message: "You've reached today's Coach turn limit",
      },
    })

    const detail = await json<{ ok: true; data: ThreadDetail }>(
      await app.request(`/api/threads/${threadId}`, {
        headers: authHeaders(cookie),
      })
    )
    expect(detail.data.messages).toHaveLength(3)
    expect(detail.data.messages[1]).toEqual(
      expect.objectContaining({
        role: "coach",
        text: "Moved it.",
        parts: [
          { type: "text", text: "Moved it." },
          {
            type: "tool",
            name: "apply_moveCard",
            summary: "Moved 'Backend Intern' to Prep",
            ok: true,
            reversal: {
              possible: true,
              description: "Undo by moving the card back.",
              command: "apply.moveCard",
            },
            toolCallId: "t1",
          },
        ],
      })
    )
    expect(detail.data.messages[2]?.text).toBe(
      "Here is another way to look at it."
    )
    expect(detail.data.messages[2]?.text).not.toMatch(/revers/i)
  })
})

describe("coach route paper focus", () => {
  let client: Awaited<ReturnType<typeof createMigratedTestDb>>["client"]
  let db: Awaited<ReturnType<typeof createMigratedTestDb>>["db"]
  let cookieA: string
  let cookieB: string

  beforeAll(async () => {
    const migrated = await createMigratedTestDb()
    client = migrated.client
    db = migrated.db
    const app = createTestApp(db, { coach: createDemoCoachRuntime() })
    cookieA = (
      await signUp(app, {
        name: "FocusA",
        email: "focus-a-coach-route@example.com",
        password: "correct-horse-battery",
      })
    ).cookie
    cookieB = (
      await signUp(app, {
        name: "FocusB",
        email: "focus-b-coach-route@example.com",
        password: "correct-horse-battery",
      })
    ).cookie
  }, 60_000)

  afterAll(async () => {
    await client.close()
  })

  async function createPaperDoc(
    app: ReturnType<typeof createTestApp>,
    cookie: string,
    name: string
  ) {
    const res = await postCommand(app, cookie, PAPER_COMMANDS.createDoc, {
      kind: "cv",
      name,
    })
    expect(res.status).toBe(200)
    const body = await json<{ ok: true; data: { id: string; name: string } }>(
      res
    )
    return body.data
  }

  it("passes the owned open Paper doc into the shared runtime", async () => {
    const seen: CoachTurnInput[] = []
    const app = createTestApp(db, {
      coach: createScriptedCoachRuntime(async function* (input) {
        seen.push(input)
        yield { type: "text-delta", text: "I read the open CV." }
        yield {
          type: "finish",
          finishReason: "stop",
          usage: { model: "mock" },
        }
      }),
    })
    const doc = await createPaperDoc(app, cookieA, "PM track CV")
    const threadId = await createThread(app, cookieA, "Paper focus")
    const res = await app.request(`/api/threads/${threadId}/coach`, {
      method: "POST",
      headers: authHeaders(cookieA),
      body: JSON.stringify({
        text: "Sharpen the checkout bullet",
        focusDocId: doc.id,
      }),
    })
    expect(res.status).toBe(200)
    await res.text()

    expect(seen).toHaveLength(1)
    expect(seen[0]?.focusDoc).toEqual({
      id: doc.id,
      name: "PM track CV",
      kind: "cv",
      status: "draft",
    })
  })

  it("passes Paper selection into the shared runtime", async () => {
    const seen: CoachTurnInput[] = []
    const app = createTestApp(db, {
      coach: createScriptedCoachRuntime(async function* (input) {
        seen.push(input)
        yield { type: "text-delta", text: "I will rewrite that line." }
        yield {
          type: "finish",
          finishReason: "stop",
          usage: { model: "mock" },
        }
      }),
    })
    const threadId = await createThread(app, cookieA, "Selection")
    const res = await app.request(`/api/threads/${threadId}/coach`, {
      method: "POST",
      headers: authHeaders(cookieA),
      body: JSON.stringify({
        text: "Rewrite selection",
        selection: { text: "old summary", sectionId: "summary" },
      }),
    })
    expect(res.status).toBe(200)
    await res.text()
    expect(seen[0]?.selection).toEqual({
      text: "old summary",
      sectionId: "summary",
    })
  })

  it("rejects an invalid focusDocId before calling the runtime", async () => {
    const app = createTestApp(db, { coach: createDemoCoachRuntime() })
    const threadId = await createThread(app, cookieA, "Bad focus")
    const res = await app.request(`/api/threads/${threadId}/coach`, {
      method: "POST",
      headers: authHeaders(cookieA),
      body: JSON.stringify({
        text: "Hello",
        focusDocId: "not-a-uuid",
      }),
    })
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({
      ok: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: expect.any(String),
      },
    })
  })

  it("rejects a missing or foreign Paper doc", async () => {
    const app = createTestApp(db, { coach: createDemoCoachRuntime() })
    const foreign = await createPaperDoc(app, cookieB, "Lan CV")
    const threadId = await createThread(app, cookieA, "Foreign focus")

    const missing = await app.request(`/api/threads/${threadId}/coach`, {
      method: "POST",
      headers: authHeaders(cookieA),
      body: JSON.stringify({
        text: "Hello",
        focusDocId: "11111111-1111-4111-8111-111111111111",
      }),
    })
    expect(missing.status).toBe(404)

    const other = await app.request(`/api/threads/${threadId}/coach`, {
      method: "POST",
      headers: authHeaders(cookieA),
      body: JSON.stringify({
        text: "Hello",
        focusDocId: foreign.id,
      }),
    })
    expect(other.status).toBe(403)
  })

  it("grounds from the Thread focus_doc_id when the body omits focusDocId", async () => {
    const seen: CoachTurnInput[] = []
    const app = createTestApp(db, {
      coach: createScriptedCoachRuntime(async function* (input) {
        seen.push(input)
        yield { type: "text-delta", text: "I still have the CV." }
        yield {
          type: "finish",
          finishReason: "stop",
          usage: { model: "mock" },
        }
      }),
    })
    const doc = await createPaperDoc(app, cookieA, "Persisted CV")
    const created = await postCommand(app, cookieA, THREAD_COMMANDS.create, {
      title: "Persisted CV",
      focusDocId: doc.id,
    })
    expect(created.status).toBe(200)
    const threadId = (await json<{ ok: true; data: ThreadListItem }>(created))
      .data.id

    const res = await app.request(`/api/threads/${threadId}/coach`, {
      method: "POST",
      headers: authHeaders(cookieA),
      body: JSON.stringify({ text: "What should I cut?" }),
    })
    expect(res.status).toBe(200)
    await res.text()

    expect(seen).toHaveLength(1)
    expect(seen[0]?.focusDoc).toEqual({
      id: doc.id,
      name: "Persisted CV",
      kind: "cv",
      status: "draft",
    })
  })
})

describe("coach auto Thread titles", () => {
  let client: Awaited<ReturnType<typeof createMigratedTestDb>>["client"]
  let db: Awaited<ReturnType<typeof createMigratedTestDb>>["db"]
  let cookie: string

  beforeAll(async () => {
    const migrated = await createMigratedTestDb()
    client = migrated.client
    db = migrated.db
    const app = createTestApp(db, { coach: createDemoCoachRuntime() })
    cookie = (
      await signUp(app, {
        name: "Title",
        email: "title-coach-route@example.com",
        password: "correct-horse-battery",
      })
    ).cookie
  }, 60_000)

  afterAll(async () => {
    await client.close()
  })

  async function loadThread(
    app: ReturnType<typeof createTestApp>,
    threadId: string
  ) {
    return json<{ ok: true; data: ThreadDetail }>(
      await app.request(`/api/threads/${threadId}`, {
        headers: authHeaders(cookie),
      })
    )
  }

  async function createUntitledThread(app: ReturnType<typeof createTestApp>) {
    const res = await postCommand(app, cookie, THREAD_COMMANDS.create, {})
    expect(res.status).toBe(200)
    const body = await json<{ ok: true; data: ThreadListItem }>(res)
    expect(body.data.title).toBe(DEFAULT_THREAD_TITLE)
    return body.data.id
  }

  it("sets a short title after the first completed turn on a default Thread", async () => {
    const app = createTestApp(db, { coach: createDemoCoachRuntime() })
    const threadId = await createUntitledThread(app)
    const userText = "Should I finish my CV first?"
    const res = await postCoach(app, cookie, threadId, userText)
    expect(res.status).toBe(200)
    await res.text()

    const detail = await loadThread(app, threadId)
    expect(detail.data.title).toBe(
      deterministicThreadTitle({
        userText,
        coachText: "I looked at Apply. Prep the starred one next.",
      })
    )
    expect(detail.data.title).not.toMatch(/!/)
    expect(detail.data.title).not.toBe(DEFAULT_THREAD_TITLE)
  })

  it("replaces a first-line title and leaves a User-renamed title alone", async () => {
    const app = createTestApp(db, { coach: createDemoCoachRuntime() })
    const userText = "Help me plan the week"
    const firstLineId = await createThread(app, cookie, titleFrom(userText))
    const renamedId = await createThread(app, cookie, "Keep this name")

    await (await postCoach(app, cookie, firstLineId, userText)).text()
    await (await postCoach(app, cookie, renamedId, userText)).text()

    expect((await loadThread(app, firstLineId)).data.title).toBe("Plan the week")
    expect((await loadThread(app, renamedId)).data.title).toBe("Keep this name")
  })

  it("does not retitle later turns", async () => {
    const app = createTestApp(db, { coach: createDemoCoachRuntime() })
    const threadId = await createUntitledThread(app)
    await (await postCoach(app, cookie, threadId, "Help me plan the week")).text()
    const afterFirst = (await loadThread(app, threadId)).data.title
    expect(afterFirst).toBe("Plan the week")

    await (await postCoach(app, cookie, threadId, "What about Paper next?")).text()
    expect((await loadThread(app, threadId)).data.title).toBe(afterFirst)
  })

  it("uses the Light-tier generator when present and stays up if it fails", async () => {
    const titled = withTitleGenerator(createDemoCoachRuntime(), async () => {
      return "Weekly plan from Apply"
    })
    const app = createTestApp(db, { coach: titled })
    const threadId = await createUntitledThread(app)
    const res = await postCoach(app, cookie, threadId, "Help me plan the week")
    expect(res.status).toBe(200)
    await res.text()
    expect((await loadThread(app, threadId)).data.title).toBe(
      "Weekly plan from Apply"
    )

    const exploding = withTitleGenerator(createDemoCoachRuntime(), async () => {
      throw new Error("light model down")
    })
    const fallbackApp = createTestApp(db, { coach: exploding })
    const fallbackId = await createUntitledThread(fallbackApp)
    const fallbackRes = await postCoach(
      fallbackApp,
      cookie,
      fallbackId,
      "Help me plan the week"
    )
    expect(fallbackRes.status).toBe(200)
    const events = parseSseEvents(await fallbackRes.text())
    expect(events.map((event) => event.event)).toContain(
      COACH_SSE_EVENTS.messageEnd
    )
    expect((await loadThread(fallbackApp, fallbackId)).data.title).toBe(
      "Plan the week"
    )
  })

  it("does not title an error turn", async () => {
    const app = createTestApp(db, {
      coach: createThrowingCoachRuntime(new Error("model exploded")),
    })
    const threadId = await createUntitledThread(app)
    const res = await postCoach(app, cookie, threadId, "Still send this")
    expect(res.status).toBe(200)
    await res.text()
    expect((await loadThread(app, threadId)).data.title).toBe(DEFAULT_THREAD_TITLE)
  })
})
