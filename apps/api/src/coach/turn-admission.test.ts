import { chatDetailSchema, type CoachTurnInput } from "@workspace/domain"
import { asc, eq } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import { chatMessages, coachUsage, user } from "../db/schema.js"
import { coachModelEnv, setCoachModelEnv } from "../config.js"
import { createDemoCoachRuntime, createScriptedCoachRuntime } from "./fake.js"
import { trackChatTurn } from "../chat/index.js"
import {
  authHeaders,
  createMigratedTestDb,
  createTestApp,
  signUp,
} from "../test/harness.js"

describe("Coach turn admission", () => {
  it("rejects disabled Coach before saving a message and rejects another account's Stop", async () => {
    const { client, db } = await createMigratedTestDb()
    try {
      const app = createTestApp(db, { coach: createDemoCoachRuntime() })
      const owner = await signUp(app, {
        name: "Owner",
        email: "coach-owner@verify.local",
      })
      const stranger = await signUp(app, {
        name: "Stranger",
        email: "coach-stranger@verify.local",
      })
      const headers = authHeaders(owner.cookie)
      const created = await app.request("/api/commands/chat.create", {
        method: "POST",
        headers,
        body: JSON.stringify({}),
      })
      const { data } = (await created.json()) as { data: { id: string } }
      const controller = new AbortController()
      const release = trackChatTurn(data.id, controller)
      const denied = await app.request("/api/commands/coach.stop", {
        method: "POST",
        headers: authHeaders(stranger.cookie),
        body: JSON.stringify({ input: { chatId: data.id } }),
      })
      expect(denied.status).toBe(404)
      expect(controller.signal.aborted).toBe(false)
      release()
      await db
        .update(user)
        .set({ agentChat: false })
        .where(eq(user.email, "coach-owner@verify.local"))
      const blocked = await app.request(`/api/chats/${data.id}/turns`, {
        method: "POST",
        headers,
        body: JSON.stringify({ text: "Hello" }),
      })
      expect(blocked.status).toBe(403)
      const detail = await app.request(`/api/chats/${data.id}`, { headers })
      expect(
        ((await detail.json()) as { data: { messages: unknown[] } }).data
          .messages
      ).toEqual([])
    } finally {
      await client.close()
    }
  })
})

describe("Coach saved grounding and cancellation", () => {
  it("recovers attachments and selection on regeneration after a successful send", async () => {
    const { client, db } = await createMigratedTestDb()
    try {
      const seen: CoachTurnInput[] = []
      const app = createTestApp(db, {
        coach: createScriptedCoachRuntime(async function* (input) {
          seen.push(input)
          yield { type: "text-delta", text: `Reply ${seen.length}` }
          yield {
            type: "finish",
            finishReason: "stop",
            usage: { model: "fake" },
          }
        }),
      })
      const { cookie } = await signUp(app, {
        name: "Grounding",
        email: "grounding@verify.local",
      })
      const headers = authHeaders(cookie)
      const created = await app.request("/api/commands/chat.create", {
        method: "POST",
        headers,
        body: "{}",
      })
      const { data } = (await created.json()) as { data: { id: string } }
      const url = `/api/chats/${data.id}/turns`
      await (
        await app.request(url, {
          method: "POST",
          headers,
          body: JSON.stringify({ text: "Earlier turn" }),
        })
      ).text()
      await (
        await app.request(url, {
          method: "POST",
          headers,
          body: JSON.stringify({
            text: "Review this passage",
            selection: { text: "selected passage", sectionId: "summary" },
            context: [{ kind: "link", id: "https://example.org/role" }],
          }),
        })
      ).text()
      await (
        await app.request(url, {
          method: "POST",
          headers,
          body: JSON.stringify({ regenerate: true }),
        })
      ).text()
      expect(seen).toHaveLength(3)
      expect(seen[2]?.selection).toEqual({
        text: "selected passage",
        sectionId: "summary",
      })
      expect(seen[2]?.note).toContain("https://example.org/role")
      const originalSecondTurn = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.chatId, data.id))
        .orderBy(asc(chatMessages.createdAt), asc(chatMessages.id))
      const receiptId = crypto.randomUUID()
      const secondTurnReply = originalSecondTurn.filter(
        (message) => message.role === "coach"
      )[1]
      expect(secondTurnReply).toBeDefined()
      await db
        .update(chatMessages)
        .set({
          parts: [
            { type: "text", text: secondTurnReply?.text ?? "" },
            {
              type: "tool",
              name: "job.move",
              summary: "Moved Associate PM to Interview",
              ok: true,
              activityId: receiptId,
              reversal: { possible: true, description: "Move it back" },
            },
          ],
        })
        .where(eq(chatMessages.id, secondTurnReply!.id))
      await (
        await app.request(url, {
          method: "POST",
          headers,
          body: JSON.stringify({ regenerate: true }),
        })
      ).text()
      const reloaded = await app.request(`/api/chats/${data.id}`, { headers })
      const detail = chatDetailSchema.parse(
        ((await reloaded.json()) as { data: unknown }).data
      )
      expect(
        detail.messages
          .filter((message) => message.role === "coach")
          .map((message) => message.text)
      ).toEqual(["Reply 1", "Reply 4"])
      const regeneratedTools = detail.messages
        .find((message) => message.text === "Reply 4")
        ?.parts.filter((part) => part.type === "tool")
      expect(regeneratedTools).toEqual([
        expect.objectContaining({ activityId: receiptId, name: "job.move" }),
      ])
      const stored = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.chatId, data.id))
        .orderBy(asc(chatMessages.createdAt), asc(chatMessages.id))
      const coachRows = stored.filter((message) => message.role === "coach")
      expect(coachRows).toHaveLength(4)
      const secondTurn = coachRows.filter(
        (message) => message.supersedesMessageId != null
      )
      expect(secondTurn).toHaveLength(2)
      expect(secondTurn[1]?.supersedesMessageId).toBe(secondTurn[0]?.id)
      const usages = await db
        .select()
        .from(coachUsage)
        .where(eq(coachUsage.chatId, data.id))
      expect(usages.map((usage) => usage.messageId).sort()).toEqual(
        coachRows.map((message) => message.id).sort()
      )
    } finally {
      await client.close()
    }
  })

  it("stops a controlled partial stream and saves exactly one aborted reply", async () => {
    const { client, db } = await createMigratedTestDb()
    let release!: () => void
    let started!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const streaming = new Promise<void>((resolve) => {
      started = resolve
    })
    try {
      const app = createTestApp(db, {
        coach: createScriptedCoachRuntime(async function* () {
          yield { type: "text-delta", text: "Partial reply" }
          started()
          await gate
          yield { type: "text-delta", text: " never shown" }
        }),
      })
      const { cookie } = await signUp(app, {
        name: "Stop",
        email: "stop-controlled@verify.local",
      })
      const headers = authHeaders(cookie)
      const created = await app.request("/api/commands/chat.create", {
        method: "POST",
        headers,
        body: "{}",
      })
      const { data } = (await created.json()) as { data: { id: string } }
      const response = await app.request(`/api/chats/${data.id}/turns`, {
        method: "POST",
        headers,
        body: JSON.stringify({ text: "Stop this" }),
      })
      const completed = response.text()
      await streaming
      const stop = await app.request("/api/commands/coach.stop", {
        method: "POST",
        headers,
        body: JSON.stringify({ input: { chatId: data.id } }),
      })
      expect(stop.status).toBe(200)
      release()
      await completed
      const detail = (await (
        await app.request(`/api/chats/${data.id}`, { headers })
      ).json()) as {
        data: { messages: { role: string; text: string; status: string }[] }
      }
      expect(
        detail.data.messages.filter((message) => message.role === "coach")
      ).toEqual([
        expect.objectContaining({ text: "Partial reply", status: "aborted" }),
      ])
    } finally {
      release()
      await client.close()
    }
  })

  it("keeps a stopped replacement current after reload and preserves it when the next attempt has no text", async () => {
    const { client, db } = await createMigratedTestDb()
    let run = 0
    let release!: () => void
    let started!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const streaming = new Promise<void>((resolve) => {
      started = resolve
    })
    try {
      const app = createTestApp(db, {
        coach: createScriptedCoachRuntime(async function* () {
          run += 1
          if (run === 1) {
            yield { type: "text-delta", text: "Original answer" }
            yield {
              type: "finish",
              finishReason: "stop",
              usage: { model: "fake" },
            }
            return
          }
          if (run === 2) {
            yield { type: "text-delta", text: "Stopped replacement" }
            started()
            await gate
            yield { type: "text-delta", text: " must not appear" }
            return
          }
          yield { type: "error", message: "No replacement text" }
        }),
      })
      const { cookie } = await signUp(app, {
        name: "Regeneration",
        email: "regeneration-stop@verify.local",
      })
      const headers = authHeaders(cookie)
      const created = await app.request("/api/commands/chat.create", {
        method: "POST",
        headers,
        body: "{}",
      })
      const { data } = (await created.json()) as { data: { id: string } }
      const url = `/api/chats/${data.id}/turns`
      await (
        await app.request(url, {
          method: "POST",
          headers,
          body: JSON.stringify({ text: "Help me" }),
        })
      ).text()
      const replacement = await app.request(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ regenerate: true }),
      })
      const replacementDone = replacement.text()
      await streaming
      const stop = await app.request("/api/commands/coach.stop", {
        method: "POST",
        headers,
        body: JSON.stringify({ input: { chatId: data.id } }),
      })
      expect(stop.status).toBe(200)
      release()
      await replacementDone

      const reload = async () => {
        const response = await app.request(`/api/chats/${data.id}`, { headers })
        return chatDetailSchema.parse(
          ((await response.json()) as { data: unknown }).data
        )
      }
      expect(
        (await reload()).messages
          .filter((message) => message.role === "coach")
          .map((message) => [message.text, message.status])
      ).toEqual([["Stopped replacement", "aborted"]])
      await (
        await app.request(url, {
          method: "POST",
          headers,
          body: JSON.stringify({ regenerate: true }),
        })
      ).text()
      expect(
        (await reload()).messages
          .filter((message) => message.role === "coach")
          .map((message) => [message.text, message.status])
      ).toEqual([["Stopped replacement", "aborted"]])
      const usages = await db
        .select()
        .from(coachUsage)
        .where(eq(coachUsage.chatId, data.id))
      expect(usages).toHaveLength(3)
      expect(usages.filter((usage) => usage.messageId == null)).toHaveLength(1)
    } finally {
      release()
      await client.close()
    }
  })
})

describe("Coach quota admission", () => {
  it("admits only one final daily turn across two concurrent chats", async () => {
    const previousEnv = coachModelEnv()
    const { client, db } = await createMigratedTestDb()
    try {
      const app = createTestApp(db, { coach: createDemoCoachRuntime() })
      setCoachModelEnv({ COACH_DAILY_TURN_LIMIT_FREE: "1" })
      const { cookie } = await signUp(app, {
        name: "Quota",
        email: "quota-race@verify.local",
      })
      const headers = authHeaders(cookie)
      const ids: string[] = []
      for (let index = 0; index < 2; index++) {
        const created = await app.request("/api/commands/chat.create", {
          method: "POST",
          headers,
          body: "{}",
        })
        ids.push(((await created.json()) as { data: { id: string } }).data.id)
      }
      const responses = await Promise.all(
        ids.map((id) =>
          app.request(`/api/chats/${id}/turns`, {
            method: "POST",
            headers,
            body: JSON.stringify({ text: "Use my last turn" }),
          })
        )
      )
      expect(responses.map((response) => response.status).sort()).toEqual([
        200, 429,
      ])
      await Promise.all(responses.map((response) => response.text()))
      const details = await Promise.all(
        ids.map(
          async (id) =>
            (await (
              await app.request(`/api/chats/${id}`, { headers })
            ).json()) as { data: { messages: { role: string }[] } }
        )
      )
      expect(
        details
          .flatMap((detail) => detail.data.messages)
          .filter((message) => message.role === "person")
      ).toHaveLength(1)
    } finally {
      setCoachModelEnv(previousEnv)
      await client.close()
    }
  })
})
