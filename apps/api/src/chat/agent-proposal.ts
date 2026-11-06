import { getDb } from "../db/context.js"
import { chats, chatMessages } from "../db/schema.js"
import { createId } from "../id.js"

export async function createAgentProposalChat(input: {
  chatId: string
  userId: string
  name: string
  command: string
  summary: string
  pendingActionId: string
}) {
  await getDb()
    .insert(chats)
    .values({
      id: input.chatId,
      userId: input.userId,
      title: `Agent connection (${input.name}, unverified)`,
    })
  await getDb()
    .insert(chatMessages)
    .values({
      id: createId(),
      chatId: input.chatId,
      role: "coach",
      text: input.summary,
      status: "final",
      parts: [
        {
          type: "tool",
          name: input.command,
          summary: input.summary,
          ok: true,
          pendingActionId: input.pendingActionId,
        },
      ],
    })
}
