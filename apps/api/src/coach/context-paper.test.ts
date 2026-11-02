import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { openCoachStore, type CoachStore } from "../test/paper-coach.js"
import { resolveTurnGrounding } from "./context.js"

let h: CoachStore

beforeAll(async () => {
  h = await openCoachStore("user-coach-context")
})

afterAll(async () => {
  await h.store.client.close()
})

describe("the Coach's view of the open paper", () => {
  it("is the v3 outline with block ids and the revision to pass as basedOn", async () => {
    await h.inDatabase(async () => {
      const { docId } = await h.created()
      await h.coach(docId, 1, [h.experience])
      const grounding = await resolveTurnGrounding({
        registry: h.store.registry,
        actor: h.store.actor,
        requestFocusDocId: docId,
        storedKind: null,
        storedId: null,
        context: [{ kind: "paper", id: docId, blockIds: ["t2"] }],
        memoryEnabled: false,
      })
      expect(grounding.focusDoc).toMatchObject({ id: docId, revision: 2 })
      expect(grounding.focusDoc?.outline).toContain("[t1] First paragraph.")
      expect(grounding.focusDoc?.outline).toContain("Experience: role: Analyst")
      expect(grounding.focusDoc).not.toHaveProperty("content")
      expect(grounding.note).toContain(">> [t2] Second paragraph.")
    })
  })
})
