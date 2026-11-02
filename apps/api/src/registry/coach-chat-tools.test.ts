import { coachActor, personActor } from "@workspace/domain"
import { describe, expect, it } from "vitest"

import { user } from "../db/schema.js"
import { withDatabase } from "../db/context.js"
import { createMigratedTestDb } from "../test/harness.js"
import { idOf } from "./coverage-helpers.js"
import { installRegistry } from "./install.js"

const CHAT_COMMANDS_THE_COACH_MAY_RUN = [
  "chat.delete",
  "chat.rename",
  "chat.setFocus",
]

describe("Coach tools on the chat surface", () => {
  it("offer only the chat commands that act on the open chat, never one that starts another", async () => {
    const { db, client } = await createMigratedTestDb()
    const registry = installRegistry()
    await db
      .insert(user)
      .values({ id: "coach-chat-tools", name: "Ada", email: "cct@example.com" })
    await withDatabase(db, async () => {
      const chat = await registry.execute({
        name: "chat.create",
        input: {},
        actor: personActor("coach-chat-tools"),
      })
      const coach = coachActor("coach-chat-tools", idOf(chat.output))
      const offered = (await registry.tools(coach))
        .filter((entry) => entry.kind === "command")
        .map((entry) => entry.name)
        .filter((name) => name.startsWith("chat."))
      expect(offered.sort()).toEqual(CHAT_COMMANDS_THE_COACH_MAY_RUN)
    })
    await client.close()
  })
})
