import { parseChatId, parseUserId } from "@workspace/domain"
import { expect, it } from "vitest"

import { exportAccount } from "../account/index.js"
import { withDatabase } from "../db/context.js"
import { chatMessages, chats, user } from "../db/schema.js"
import { createId } from "../id.js"
import { installRegistry } from "../registry/install.js"
import { createMigratedTestDb } from "../test/harness.js"
import { getChat } from "./store.js"
import { UNREADABLE_STEP_LINE } from "./stored-parts.js"

it("a saved step that cannot be read stays in the chat as one plain line and in the export as saved", async () => {
  const { db, client } = await createMigratedTestDb()
  installRegistry()
  try {
    await withDatabase(db, async () => {
      const userId = parseUserId(createId())
      const chatId = parseChatId(createId())
      const unreadable = {
        type: "tool",
        name: "job.move",
        summary: "Moved",
        ok: true,
        approval: "approved",
        pendingActionId: "proposal",
        outcome: "surprise",
      }
      await db
        .insert(user)
        .values({ id: userId, name: "Ada", email: `${userId}@example.com` })
      await db.insert(chats).values({ id: chatId, userId, title: "Chat" })
      await db.insert(chatMessages).values({
        id: createId(),
        chatId,
        role: "coach",
        text: "Done.",
        parts: [{ type: "text", text: "Done." }, unreadable],
      })
      const chat = await getChat(userId, chatId)
      expect(chat.messages.map((message) => message.parts)).toEqual([
        [
          { type: "text", text: "Done." },
          { type: "text", text: UNREADABLE_STEP_LINE },
        ],
      ])
      const exported = await exportAccount(userId)
      expect(exported.messages.map((message) => message.parts)).toEqual([
        [{ type: "text", text: "Done." }, unreadable],
      ])
    })
  } finally {
    await client.close()
  }
})
