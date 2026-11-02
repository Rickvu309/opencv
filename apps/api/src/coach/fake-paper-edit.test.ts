import { coachActor, type CoachStreamPart } from "@workspace/domain"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { openCoachStore, type CoachStore } from "../test/paper-coach.js"
import { resolveTurnGrounding } from "./context.js"
import { createDemoCoachRuntime } from "./fake.js"

const userId = "user-coach-fake-edit"
const chatId = "00000000-0000-4000-8000-000000000381"
let h: CoachStore

beforeAll(async () => {
  h = await openCoachStore(userId)
})

afterAll(async () => {
  await h.store.client.close()
})

describe("the fake Coach", () => {
  it("edits the open paper through paper.edit and returns a receipt", async () => {
    await h.inDatabase(async () => {
      const { docId } = await h.created()
      const grounding = await resolveTurnGrounding({
        registry: h.store.registry,
        actor: h.store.actor,
        requestFocusDocId: docId,
        storedKind: null,
        storedId: null,
        memoryEnabled: false,
      })
      const actor = coachActor(userId, chatId)
      const parts: CoachStreamPart[] = []
      for await (const part of createDemoCoachRuntime().streamTurn({
        userId,
        chatId,
        history: [],
        focusDoc: grounding.focusDoc,
        execute: (call) =>
          h.store.registry.execute({
            name: call.name,
            input: call.input,
            actor,
          }),
      })) {
        parts.push(part)
      }
      const result = parts.find((part) => part.type === "tool-result")
      expect(result).toMatchObject({
        name: "paper.edit",
        ok: true,
        reversal: { possible: true, command: "paper.revertEdit" },
        detail: { type: "paper.replace", docKind: "cv" },
      })
      const blocks = (await h.paperOf(docId)).blocks
      expect(blocks.map((block) => block.id)[0]).toBe("s1")
      expect(JSON.stringify(blocks)).toContain("Reviewed by the Coach.")
      expect(blocks).toHaveLength(4)
    })
  })
})
