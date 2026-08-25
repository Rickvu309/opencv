import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { listApplyCardsForUser } from "../../apply/queries.js"
import { listPaperDocsForUser } from "../../paper/queries.js"
import { createMigratedTestDb } from "../../test/harness.js"
import { GOLDEN_SCENARIOS } from "./scenarios.js"
import { seedGoldenScenario } from "./seed.js"

describe("seedGoldenScenario", () => {
  let client: Awaited<ReturnType<typeof createMigratedTestDb>>["client"]
  let db: Awaited<ReturnType<typeof createMigratedTestDb>>["db"]

  beforeAll(async () => {
    const migrated = await createMigratedTestDb()
    client = migrated.client
    db = migrated.db
  }, 60_000)

  afterAll(async () => {
    await client.close()
  })

  it("writes the move-card workspace without a demo persona", async () => {
    const scenario = GOLDEN_SCENARIOS.find(
      (entry) => entry.id === "move-starred-card"
    )
    if (!scenario) throw new Error("missing move-starred-card")

    const seeded = await seedGoldenScenario(db, scenario)
    const paper = await listPaperDocsForUser(db, seeded.userId)
    const apply = await listApplyCardsForUser(db, seeded.userId)

    expect(paper).toHaveLength(1)
    expect(paper[0]?.name).toBe("Internship CV")
    expect(JSON.stringify(paper)).not.toMatch(/Eric Nguyen/)
    expect(apply).toHaveLength(2)
    expect(apply.some((card) => card.starred && card.stage === "inbox")).toBe(
      true
    )
    expect(seeded.threadId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    )
  })
})
