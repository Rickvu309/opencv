import {
  QUERY_NAMES,
  chatContract,
  coachActor,
  personActor,
  queries,
} from "@workspace/domain"
import { describe, expect, it } from "vitest"

import { stopChat, trackChatTurn } from "./commands.js"
import { insertCoachMessage } from "./store.js"
import { withDatabase } from "../db/context.js"
import { user } from "../db/schema.js"
import { createMigratedTestDb } from "../test/harness.js"
import { installRegistry } from "../registry/install.js"

describe("chat contract", () => {
  it("parses every chat, actions and activity command output and both chat reads", async () => {
    const { db, client } = await createMigratedTestDb()
    const registry = installRegistry()
    const userId = "user-chat-contract"
    await db.insert(user).values({
      id: userId,
      name: "Ada",
      email: "ada-chat-contract@example.com",
    })
    const person = personActor(userId)

    await withDatabase(db, async () => {
      const seen = new Set<string>()
      const run = async (name: keyof typeof chatContract, input: unknown) => {
        const result = await registry.execute({ name, input, actor: person })
        const parsed = chatContract[name].output.safeParse(result.output)
        expect(
          parsed.success,
          `${name}: ${JSON.stringify(parsed.error?.issues)}`
        ).toBe(true)
        seen.add(name)
        return result
      }
      const read = async (name: "chat.list" | "chat.get", input: unknown) => {
        const output = await registry.read(name, input, person)
        const parsed = queries[name].output.safeParse(output)
        expect(
          parsed.success,
          `${name}: ${JSON.stringify(parsed.error?.issues)}`
        ).toBe(true)
        seen.add(name)
        return output
      }

      const created = (await run("chat.create", { title: "Plan" })).output as {
        id: string
      }
      const chatId = created.id
      await run("chat.rename", { chatId, title: "Plan v2" })
      await run("chat.open", {})
      const job = await registry.execute({
        name: "job.create",
        input: { title: "Associate PM", company: "Northwind" },
        actor: person,
      })
      const jobId = (job.output as { id: string }).id
      await run("chat.setFocus", { chatId, focus: { kind: "job", id: jobId } })
      await run("chat.setFocus", { chatId, focus: null })
      await run("chat.appendMessage", {
        chatId,
        text: "Hello",
        attachments: [{ kind: "job", id: jobId, label: "Associate PM" }],
      })
      await insertCoachMessage({
        chatId: chatId as never,
        userId: userId as never,
        text: "Moved it.",
        parts: [
          { type: "text", text: "Moved it." },
          { type: "tool", name: "job_move", summary: "Moved", ok: true },
        ],
        status: "final",
        workedMs: 12,
      })

      const listed = (await read("chat.list", {})) as { id: string }[]
      expect(listed.map((chat) => chat.id)).toContain(chatId)
      const detail = (await read("chat.get", { chatId })) as {
        messages: { role: string }[]
      }
      expect(detail.messages.map((message) => message.role)).toEqual([
        "person",
        "coach",
      ])

      trackChatTurn(chatId, new AbortController())
      await run("coach.stop", { chatId })
      expect(stopChat(chatId)).toBe(false)

      const approveChat = (await run("chat.create", { title: "Approve" }))
        .output as { id: string }
      const pendingFor = async (stage: string) => {
        const pending = await registry.execute({
          name: "job.move",
          input: { jobId, stage },
          actor: coachActor(userId, approveChat.id),
        })
        if (!pending.pendingActionId) throw new Error("missing pending action")
        return pending.pendingActionId
      }
      await run("actions.approve", {
        pendingActionId: await pendingFor("interview"),
      })
      await run("actions.deny", {
        pendingActionId: await pendingFor("applied"),
      })

      const moved = await registry.execute({
        name: "job.move",
        input: { jobId, stage: "saved" },
        actor: person,
      })
      await run("activity.undo", { activityId: moved.activityId })
      await run("chat.delete", { chatId })

      expect([...seen].sort()).toEqual(
        [...Object.keys(chatContract), "chat.get", "chat.list"].sort()
      )
    })
    await client.close()
  })

  it("keeps the chat reads on the query table", () => {
    expect(QUERY_NAMES).toContain("chat.list")
    expect(QUERY_NAMES).toContain("chat.get")
  })
})
