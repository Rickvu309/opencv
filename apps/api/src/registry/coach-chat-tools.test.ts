import { personActor } from "@workspace/domain"
import { describe, expect, it } from "vitest"

import { user } from "../db/schema.js"
import { withDatabase } from "../db/context.js"
import { createMigratedTestDb } from "../test/harness.js"
import { idOf } from "./coverage-helpers.test-support.js"
import { installRegistry } from "../install.js"
import { seedCoachActor } from "../test/coach-turn.js"

const CHAT_COMMANDS_THE_COACH_MAY_RUN = [
  "chat.delete",
  "chat.rename",
  "chat.setFocus",
]

describe("the Coach chat tools exclude chat.create", () => {
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
      const coach = await seedCoachActor("coach-chat-tools", idOf(chat.output))
      const offered = (await registry.tools(coach))
        .filter((entry) => entry.kind === "command")
        .map((entry) => entry.name)
        .filter((name) => name.startsWith("chat."))
      expect(offered.sort()).toEqual(CHAT_COMMANDS_THE_COACH_MAY_RUN)
    })
    await client.close()
  })
})
