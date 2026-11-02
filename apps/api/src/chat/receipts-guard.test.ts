import { parseUserId } from "@workspace/domain"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { openCoachStore, type CoachStore } from "../test/paper-coach.js"
import { createChat, getChat, insertCoachMessage } from "./store.js"

const userId = "user-chat-receipt-guard"
let h: CoachStore

beforeAll(async () => {
  h = await openCoachStore(userId)
})

afterAll(async () => {
  await h.store.client.close()
})

describe("chat receipts for Coach edits", () => {
  it("turn Undo off for an older edit a newer one was built on", async () => {
    await h.inDatabase(async () => {
      const { docId } = await h.created()
      const older = await h.coach(docId, 1, [
        { op: "setText", blockId: "t1", text: "First paragraph. A" },
      ])
      await h.coach(docId, 2, [
        { op: "setText", blockId: "t1", text: "First paragraph. A B" },
      ])
      const chat = await createChat(h.store.actor, "Receipts")
      const part = (editId: string, activityId: string) => ({
        type: "tool" as const,
        name: "paper_edit",
        summary: "Edited CV",
        ok: true,
        activityId,
        reversal: {
          possible: true,
          description: "Edited CV",
          command: "paper.revertEdit",
          input: { docId, editId },
        },
      })
      await insertCoachMessage({
        chatId: chat.id as never,
        userId: parseUserId(userId),
        text: "Edited.",
        status: "final",
        workedMs: 5,
        parts: [part(older.output.editId!, older.activityId!)] as never,
      })
      const read = await getChat(parseUserId(userId), chat.id as never)
      const parts = read.messages.flatMap((message) => message.parts)
      expect(parts[0]).toMatchObject({
        reversal: {
          possible: false,
          description: expect.stringContaining("newer Coach edit"),
        },
      })
    })
  })
})
