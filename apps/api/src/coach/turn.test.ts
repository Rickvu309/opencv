import { emptyCvDocument, titleFrom } from "@workspace/domain"
import { afterAll, describe, expect, it } from "vitest"

import { createDemoCoachRuntime, createScriptedCoachRuntime } from "./fake.js"
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
      body: JSON.stringify({ title: titleFrom(prompt) }),
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
      body: JSON.stringify({}),
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

describe("coach turn receipts", () => {
  it("carries the activity id to the stream and the stored part, and chat.get marks it undone after activity.undo", async () => {
    const { client, db } = await createMigratedTestDb()
    let headers: Record<string, string> = {}
    const app = createTestApp(db, {
      coach: createScriptedCoachRuntime(async function* () {
        const moved = await app.request("/api/commands/job.create", {
          method: "POST",
          headers,
          body: JSON.stringify({
            input: { title: "Intern", company: "Northwind" },
          }),
        })
        const body = (await moved.json()) as {
          data: { id: string; activityId: string }
        }
        yield {
          type: "tool-result",
          toolCallId: "call_job",
          name: "job.create",
          summary: "Added Intern",
          ok: true,
          command: "job.create",
          activityId: body.data.activityId,
          reversal: {
            possible: true,
            description: "Remove it",
            command: "activity.undo",
            input: { activityId: body.data.activityId },
          },
          result: { ok: true, data: {} },
        }
        yield {
          type: "finish",
          finishReason: "stop",
          usage: { model: "fake", finishReason: "stop" },
        }
      }),
    })
    const { cookie } = await signUp(app, {
      name: "Ada Receipt",
      email: "ada-receipt@verify.local",
    })
    headers = authHeaders(cookie)
    const created = await app.request("/api/commands/chat.create", {
      method: "POST",
      headers,
      body: JSON.stringify({}),
    })
    const chatId = ((await created.json()) as { data: { id: string } }).data.id
    const turn = await app.request(`/api/chats/${chatId}/turns`, {
      method: "POST",
      headers,
      body: JSON.stringify({ text: "Add the job" }),
    })
    const sse = await turn.text()
    const activityId = /"activityId":"([^"]+)"/.exec(sse)?.[1]
    expect(activityId).toEqual(expect.any(String))

    const read = async () =>
      (await (
        await app.request(`/api/chats/${chatId}`, { headers })
      ).json()) as {
        data: {
          messages: { parts: { activityId?: string; undone?: boolean }[] }[]
        }
      }
    const partOf = (detail: Awaited<ReturnType<typeof read>>) =>
      detail.data.messages
        .flatMap((message) => message.parts)
        .find((part) => part.activityId === activityId)
    expect(partOf(await read())).toBeDefined()
    expect(partOf(await read())?.undone).toBeUndefined()

    const undone = await app.request("/api/commands/activity.undo", {
      method: "POST",
      headers,
      body: JSON.stringify({ input: { activityId } }),
    })
    expect(undone.status).toBe(200)
    expect(partOf(await read())?.undone).toBe(true)
    await client.close()
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
