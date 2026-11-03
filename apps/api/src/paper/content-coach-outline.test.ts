import type { PaperDocument } from "@workspace/domain"
import { coachActor } from "@workspace/domain"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { openCoachStore, type CoachStore } from "../test/paper-coach.js"
import { createId } from "../id.js"

const userId = "user-coach-outline"
let h: CoachStore

beforeAll(async () => {
  h = await openCoachStore(userId)
})

afterAll(async () => {
  await h.store.client.close()
})

const inDatabase = <T>(run: () => Promise<T>) => h.inDatabase(run)

describe("paper.outline and the Coach tool list", () => {
  it("reads the v3 document with titles, levels, marks and links", async () => {
    await inDatabase(async () => {
      const { docId, client } = await h.created()
      await h.person(
        docId,
        client,
        (paper) =>
          ({
            ...paper,
            blocks: paper.blocks.map((block) =>
              block.id === "t1"
                ? {
                    id: "t1",
                    type: "heading",
                    level: 3,
                    content: [
                      { text: "Site", href: "https://example.com", bold: true },
                    ],
                  }
                : block.type === "section"
                  ? { ...block, title: "Profile" }
                  : block
            ),
          }) as PaperDocument
      )
      const outline = (await h.store.registry.read(
        "paper.outline",
        { docId, blockIds: ["t2"] },
        h.store.actor
      )) as { revision: number; outline: string; truncated: boolean }
      expect(outline.revision).toBe(2)
      expect(outline.truncated).toBe(false)
      expect(outline.outline).toContain("[s1] # Profile (section summary)")
      expect(outline.outline).toContain(
        "[t1] ### **[Site](https://example.com)**"
      )
      expect(outline.outline).toContain(">> [t2] Second paragraph.")
    })
  })

  it("offers paper.edit and paper.outline to the Coach, and not paper.replace", async () => {
    await inDatabase(async () => {
      const names = (
        await h.store.registry.tools(
          coachActor(userId, "00000000-0000-4000-8000-000000000380", createId())
        )
      ).map((entry) => entry.name)
      expect(names).toContain("paper.edit")
      expect(names).toContain("paper.outline")
      expect(names).not.toContain("paper.replace")
      expect(names).not.toContain("paper.revertEdit")
    })
  })
})
