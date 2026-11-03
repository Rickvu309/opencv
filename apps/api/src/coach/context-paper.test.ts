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

  it("is cleared by a null focus id, while an undefined one keeps the stored paper", async () => {
    await h.inDatabase(async () => {
      const { docId } = await h.created()
      const base = {
        registry: h.store.registry,
        actor: h.store.actor,
        storedKind: "paper",
        storedId: docId,
        memoryEnabled: false,
      }
      const cleared = await resolveTurnGrounding({
        ...base,
        requestFocusDocId: null,
      })
      expect(cleared.focusDoc).toBeUndefined()
      expect(cleared.note ?? "").not.toContain("Open document")
      const kept = await resolveTurnGrounding({
        ...base,
        requestFocusDocId: undefined,
      })
      expect(kept.focusDoc).toMatchObject({ id: docId })
      expect(kept.note).toContain("Open document")
    })
  })

  it("names an attached file by name, type and size and never carries its bytes", async () => {
    const registry = {
      read: async (name: string) =>
        name === "file.get"
          ? {
              name: "cv.pdf",
              mediaType: "application/pdf",
              byteSize: 12,
              bytes: "SECRET-FILE-BYTES",
            }
          : null,
    } as unknown as Parameters<typeof resolveTurnGrounding>[0]["registry"]
    const grounding = await resolveTurnGrounding({
      registry,
      actor: h.store.actor,
      requestFocusDocId: undefined,
      storedKind: null,
      storedId: null,
      context: [{ kind: "file", id: "file-1" }],
      memoryEnabled: false,
    })
    expect(grounding.note).toContain(
      "File: cv.pdf (application/pdf, 12 bytes)."
    )
    expect(grounding.note).not.toContain("SECRET-FILE-BYTES")
  })
})
