import { execFile } from "node:child_process"
import { promisify } from "node:util"

import { serve } from "@hono/node-server"
import type { ServerType } from "@hono/node-server"
import {
  COACH_SSE_EVENTS,
  DEFAULT_COACH_MODEL,
  ERROR_CODES,
  THREAD_COMMANDS,
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
  init?: RequestInit
) {
  return app.request(`/api/threads/${threadId}/coach`, {
    method: "POST",
    headers: authHeaders(cookie),
    body: JSON.stringify({ text }),
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
        model: DEFAULT_COACH_MODEL,
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
        model: DEFAULT_COACH_MODEL,
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

  it("writes a heartbeat comment while the runtime is working", async () => {
    const app = createTestApp(db, {
      coach: createScriptedCoachRuntime(async function* () {
        await new Promise((resolve) => setTimeout(resolve, 50))
        yield { type: "text-delta", text: "Hi" }
        yield {
          type: "finish",
          finishReason: "stop",
          usage: { model: DEFAULT_COACH_MODEL },
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
