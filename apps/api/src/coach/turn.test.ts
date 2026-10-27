import { coachModeCaps, emptyCvDocument, titleFrom } from "@workspace/domain"
import { afterAll, describe, expect, it, vi } from "vitest"

import { coachModelEnv } from "../config.js"
import {
  HOLD_MS,
  createDemoCoachRuntime,
  createScriptedCoachRuntime,
} from "./fake.js"
import { toolResultFromExecute } from "./turn.js"
import {
  authHeaders,
  createMigratedTestDb,
  createTestApp,
  signUp,
} from "../test/harness.js"

const prompt = "Help me prepare for a product intern interview"

describe("coach turn title", () => {
  let close: (() => Promise<void>) | undefined

  afterAll(async () => {
    await close?.()
  })

  it("replaces the first-line title after the scripted turn", async () => {
    const { client, db } = await createMigratedTestDb()
    close = () => client.close()
    const app = createTestApp(db, { coach: createDemoCoachRuntime() })
    const { cookie } = await signUp(app, {
      name: "Ada Verify",
      email: "ada-title@verify.local",
    })
    const headers = authHeaders(cookie)

    const created = await app.request("/api/commands/chat.create", {
      method: "POST",
      headers,
      body: JSON.stringify({ input: { title: titleFrom(prompt) } }),
    })
    expect(created.status).toBe(200)
    const createdBody = (await created.json()) as {
      data: { id: string; title: string }
    }
    expect(createdBody.data.title).toBe(titleFrom(prompt))

    const turn = await app.request(`/api/chats/${createdBody.data.id}/turns`, {
      method: "POST",
      headers,
      body: JSON.stringify({ text: prompt }),
    })
    expect(turn.status).toBe(200)
    const sse = await turn.text()
    expect(sse).toContain("Prep the starred one next.")
    expect(sse).toContain("event: usage")
    expect(sse.indexOf("event: step")).toBeGreaterThan(-1)
    expect(sse.indexOf("event: step")).toBeLessThan(
      sse.indexOf("event: tool-result")
    )
    expect(sse).toContain("Listed your Apply cards")

    const list = await app.request("/api/chats", { headers })
    expect(list.status).toBe(200)
    const threads = (await list.json()) as {
      data: { id: string; title: string }[]
    }
    expect(
      threads.data.find((thread) => thread.id === createdBody.data.id)?.title
    ).toBe("Prepare for a product intern interview")
  })

  it("forwards confirm, reversal, and detail from a scripted tool result", async () => {
    const { client, db } = await createMigratedTestDb()
    close = () => client.close()
    const app = createTestApp(db, {
      coach: createScriptedCoachRuntime([
        {
          type: "tool-result",
          toolCallId: "call_pending",
          name: "job.move",
          summary: "Move to applied",
          ok: true,
          pendingActionId: "pending-1",
          command: "job.move",
          reversal: {
            possible: true,
            description: "Move back",
            command: "job.move",
            input: { stage: "saved" },
          },
          detail: {
            type: "apply.moveCard",
            title: "Intern",
            company: "Northwind",
            from: "inbox",
            to: "sent",
          },
          result: { ok: true, data: {} },
        },
        {
          type: "finish",
          finishReason: "stop",
          usage: { model: "fake", finishReason: "stop" },
        },
      ]),
    })
    const { cookie } = await signUp(app, {
      name: "Ada Confirm",
      email: "ada-confirm@verify.local",
    })
    const headers = authHeaders(cookie)
    const created = await app.request("/api/commands/chat.create", {
      method: "POST",
      headers,
      body: JSON.stringify({ input: {} }),
    })
    const createdBody = (await created.json()) as { data: { id: string } }
    const turn = await app.request(`/api/chats/${createdBody.data.id}/turns`, {
      method: "POST",
      headers,
      body: JSON.stringify({ text: "Move the card" }),
    })
    expect(turn.status).toBe(200)
    const sse = await turn.text()
    expect(sse).toContain("event: confirm")
    expect(sse).toContain("pending-1")
    expect(sse).toContain("job.move")
    expect(sse).toContain('"reversal"')
    expect(sse).toContain("apply.moveCard")
  })
})

describe("coach turn contract", () => {
  let close: (() => Promise<void>) | undefined

  afterAll(async () => {
    await close?.()
  })

  it("accepts attachments and stores them on the person message", async () => {
    const { client, db } = await createMigratedTestDb()
    close = () => client.close()
    const app = createTestApp(db, { coach: createDemoCoachRuntime() })
    const { cookie } = await signUp(app, {
      name: "Ada Attach",
      email: "ada-attach@verify.local",
    })
    const headers = authHeaders(cookie)
    const created = await app.request("/api/commands/chat.create", {
      method: "POST",
      headers,
      body: JSON.stringify({ input: {} }),
    })
    const createdBody = (await created.json()) as { data: { id: string } }
    const turn = await app.request(`/api/chats/${createdBody.data.id}/turns`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        text: "Review my CV",
        mode: "free",
        attachments: [
          { kind: "paper", id: "doc-1", label: "Junior Marketing CV" },
        ],
      }),
    })
    expect(turn.status).toBe(200)
    const detail = await app.request(`/api/chats/${createdBody.data.id}`, {
      headers,
    })
    const body = (await detail.json()) as {
      data: { messages: { role: string; parts: unknown }[] }
    }
    const person = body.data.messages.find(
      (message) => message.role === "person"
    )
    expect(person?.parts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "attachment",
          kind: "paper",
          id: "doc-1",
          label: "Junior Marketing CV",
        }),
      ])
    )
  })

  it("emits step before a tool result", async () => {
    const { client, db } = await createMigratedTestDb()
    close = () => client.close()
    const app = createTestApp(db, {
      coach: createScriptedCoachRuntime([
        {
          type: "tool-call",
          toolCallId: "call_jobs",
          name: "job.list",
          input: {},
        },
        {
          type: "tool-result",
          toolCallId: "call_jobs",
          name: "job.list",
          summary: "Listed jobs",
          ok: true,
          result: { ok: true, data: [] },
        },
        {
          type: "finish",
          finishReason: "stop",
          usage: { model: "fake", finishReason: "stop" },
        },
      ]),
    })
    const { cookie } = await signUp(app, {
      name: "Ada Step",
      email: "ada-step@verify.local",
    })
    const headers = authHeaders(cookie)
    const created = await app.request("/api/commands/chat.create", {
      method: "POST",
      headers,
      body: JSON.stringify({ input: {} }),
    })
    const createdBody = (await created.json()) as { data: { id: string } }
    const turn = await app.request(`/api/chats/${createdBody.data.id}/turns`, {
      method: "POST",
      headers,
      body: JSON.stringify({ text: "List jobs" }),
    })
    expect(turn.status).toBe(200)
    const sse = await turn.text()
    const stepAt = sse.indexOf("event: step")
    const resultAt = sse.indexOf("event: tool-result")
    expect(stepAt).toBeGreaterThan(-1)
    expect(resultAt).toBeGreaterThan(stepAt)
    expect(sse).toContain("List jobs")
    expect(sse).toMatch(/event: message-end\ndata: \{[^}]*"workedMs":\d+/)
  })

  it("returns mode caps on the usage snapshot", async () => {
    const { client, db } = await createMigratedTestDb()
    close = () => client.close()
    const app = createTestApp(db, { coach: createDemoCoachRuntime() })
    const { cookie } = await signUp(app, {
      name: "Ada Caps",
      email: "ada-caps@verify.local",
    })
    const usage = await app.request("/api/coach/usage", {
      headers: authHeaders(cookie),
    })
    expect(usage.status).toBe(200)
    const body = (await usage.json()) as {
      data: { caps: { free: number; light: number; max: number } }
    }
    expect(body.data.caps).toEqual(coachModeCaps(coachModelEnv()))
  })

  it("returns 404 for the removed thread coach route", async () => {
    const { client, db } = await createMigratedTestDb()
    close = () => client.close()
    const app = createTestApp(db, { coach: createDemoCoachRuntime() })
    const { cookie } = await signUp(app, {
      name: "Ada Gone",
      email: "ada-gone@verify.local",
    })
    const missing = await app.request(
      "/api/threads/00000000-0000-4000-8000-000000000001/coach",
      {
        method: "POST",
        headers: authHeaders(cookie),
        body: JSON.stringify({ text: "Hello" }),
      }
    )
    expect(missing.status).toBe(404)
  })
})

describe("demo coach scenarios", () => {
  let close: (() => Promise<void>) | undefined

  afterAll(async () => {
    await close?.()
  })

  it("holds the stream open before the default reply", async () => {
    vi.useFakeTimers()
    const runtime = createDemoCoachRuntime()
    const stream = runtime.streamTurn({
      userId: "user",
      threadId: "chat",
      history: [
        {
          id: "m1",
          role: "user",
          text: "please hold",
          createdAt: "2026-10-27T00:00:00.000Z",
        },
      ],
    })
    const iter = stream[Symbol.asyncIterator]()
    const first = await iter.next()
    expect(first.value).toMatchObject({ type: "tool-call", name: "job.list" })
    let settled = false
    const second = iter.next().then((value) => {
      settled = true
      return value
    })
    await vi.advanceTimersByTimeAsync(HOLD_MS - 1)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect((await second).value).toMatchObject({
      type: "text-delta",
      text: "I looked at Apply. ",
    })
    vi.useRealTimers()
  })

  it("emits a fixed code when the script fails", async () => {
    const { client, db } = await createMigratedTestDb()
    close = () => client.close()
    const app = createTestApp(db, { coach: createDemoCoachRuntime() })
    const { cookie } = await signUp(app, {
      name: "Ada Fail",
      email: "ada-fail@verify.local",
    })
    const headers = authHeaders(cookie)
    const created = await app.request("/api/commands/chat.create", {
      method: "POST",
      headers,
      body: JSON.stringify({ input: {} }),
    })
    const createdBody = (await created.json()) as { data: { id: string } }
    const turn = await app.request(`/api/chats/${createdBody.data.id}/turns`, {
      method: "POST",
      headers,
      body: JSON.stringify({ text: "please fail this turn" }),
    })
    expect(turn.status).toBe(200)
    const sse = await turn.text()
    expect(sse).toContain("INTERNAL_ERROR")
    expect(sse).not.toContain("database password")
  })

  it("confirms a real pending edit and names the document", async () => {
    const { client, db } = await createMigratedTestDb()
    close = () => client.close()
    const app = createTestApp(db, { coach: createDemoCoachRuntime() })
    const { cookie } = await signUp(app, {
      name: "Ada Confirm Live",
      email: "ada-confirm-live@verify.local",
    })
    const headers = authHeaders(cookie)
    const created = await app.request("/api/commands/chat.create", {
      method: "POST",
      headers,
      body: JSON.stringify({ input: {} }),
    })
    const createdBody = (await created.json()) as { data: { id: string } }
    const turn = await app.request(`/api/chats/${createdBody.data.id}/turns`, {
      method: "POST",
      headers,
      body: JSON.stringify({ text: "please confirm the edit" }),
    })
    expect(turn.status).toBe(200)
    const sse = await turn.text()
    expect(sse.indexOf("event: step")).toBeGreaterThan(-1)
    expect(sse.indexOf("event: step")).toBeLessThan(
      sse.indexOf("event: confirm")
    )
    expect(sse).toContain("Coach note")
    expect(sse).toContain("Update the document")
    const pendingActionId = sse.match(/"pendingActionId":"([^"]+)"/)?.[1]
    expect(pendingActionId).toBeTruthy()
    const approved = await app.request("/api/commands/actions.approve", {
      method: "POST",
      headers,
      body: JSON.stringify({ input: { pendingActionId } }),
    })
    expect(approved.status).toBe(200)
    const body = (await approved.json()) as {
      data: {
        id?: string
        summary?: string
        detail?: { name?: string; docId?: string }
      }
    }
    expect(body.data.detail?.name).toBe("Coach note")
    expect(body.data.detail?.docId).toBeTruthy()
    expect(body.data.id).toBeTruthy()
  })
})

describe("toolResultFromExecute", () => {
  it("puts reversal and detail on the yielded part", () => {
    const part = toolResultFromExecute({
      toolCallId: "call_1",
      name: "paper.replace",
      summary: "Update the document",
      result: {
        pending: false,
        activityId: null,
        reversal: { command: "paper.replace", input: { docId: "doc" } },
        output: {
          kind: "cv",
          name: "CV",
          document: emptyCvDocument(),
          previousDocument: emptyCvDocument(),
        },
      },
    })
    expect(part.reversal).toMatchObject({
      possible: true,
      command: "paper.replace",
    })
    expect(part.detail).toMatchObject({
      type: "paper.updateContent",
      docKind: "cv",
      docName: "CV",
    })
  })
})
