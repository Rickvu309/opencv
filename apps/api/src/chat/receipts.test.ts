import { parseUserId, personActor } from "@workspace/domain"
import { describe, expect, it } from "vitest"

import { withDatabase } from "../db/context.js"
import { activity, user } from "../db/schema.js"
import { createId } from "../id.js"
import { installRegistry } from "../registry/install.js"
import { createMigratedTestDb } from "../test/harness.js"
import { createChat, getChat, insertCoachMessage } from "./store.js"

describe("chat receipts", () => {
  it("marks a receipt undone once its activity row is undone", async () => {
    const { db, client } = await createMigratedTestDb()
    const registry = installRegistry()
    const userId = "user-chat-receipts"
    await db.insert(user).values({
      id: userId,
      name: "Ada",
      email: "ada-chat-receipts@example.com",
    })
    const actor = personActor(userId)
    await withDatabase(db, async () => {
      const chat = await createChat(actor, "Receipts")
      const open = createId()
      const done = createId()
      for (const id of [open, done]) {
        await db.insert(activity).values({
          id,
          userId,
          actor: "coach",
          command: "job.move",
          subjectKind: "job",
          subjectId: id,
          summary: "Moved",
          undoneAt: id === done ? new Date() : null,
        })
      }
      await insertCoachMessage({
        chatId: chat.id as never,
        userId: parseUserId(userId),
        text: "Moved both.",
        status: "final",
        workedMs: 5,
        parts: [
          {
            type: "tool",
            name: "job_move",
            summary: "a",
            ok: true,
            activityId: open,
          },
          {
            type: "tool",
            name: "job_move",
            summary: "b",
            ok: true,
            activityId: done,
          },
        ],
      })
      const read = (await registry.read(
        "chat.get",
        { chatId: chat.id },
        actor
      )) as {
        messages: { parts: { activityId: string; undone?: boolean }[] }[]
      }
      const parts = read.messages[0]!.parts
      expect(parts.find((p) => p.activityId === open)?.undone).toBeUndefined()
      expect(parts.find((p) => p.activityId === done)?.undone).toBe(true)
      expect((await getChat(parseUserId(userId), chat.id as never)).id).toBe(
        chat.id
      )
    })
    await client.close()
  })
})
