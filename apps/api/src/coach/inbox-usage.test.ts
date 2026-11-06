import { COACH_MODEL, personActor, type InboxDetail } from "@workspace/domain"
import { describe, expect, it, vi } from "vitest"
import { coachModelEnv, setCoachModelEnv } from "../config.js"
import { withDatabase } from "../db/context.js"
import { coachUsage, user } from "../db/schema.js"
import { installRegistry } from "../registry/install.js"
import { createMigratedTestDb } from "../test/harness.js"
import { anthropicFixtureResponse } from "./anthropic-fixture.js"

describe("Inbox Coach usage", () => {
  it("saves the actual Anthropic provider and model for free-plan reply drafting", async () => {
    const { db, client } = await createMigratedTestDb()
    vi.stubEnv("COACH_RUNTIME", "")
    const previous = coachModelEnv()
    setCoachModelEnv({ ANTHROPIC_API_KEY: "fixture" })
    const fetch = vi.fn(async () =>
      anthropicFixtureResponse([
        { type: "text-delta", delta: "Thanks. Could we arrange another time?" },
      ])
    )
    vi.stubGlobal("fetch", fetch)
    try {
      await db.insert(user).values({
        id: "inbox-sdk-user",
        name: "Ada",
        email: "inbox-sdk@verify.local",
      })
      await withDatabase(db, async () => {
        const registry = installRegistry()
        const actor = personActor("inbox-sdk-user")
        const scanned = await registry.execute({
          name: "inbox.scan",
          input: {},
          actor,
        })
        const threadId = (scanned.output as { threads: { id: string }[] })
          .threads[0]!.id
        await registry.execute({
          name: "inbox.draftReply",
          input: { threadId, hint: "Arrange another time" },
          actor,
        })
        const detail = (await registry.read(
          "inbox.get",
          { threadId },
          actor
        )) as InboxDetail
        expect(detail.draft?.body).toBe(
          "Thanks. Could we arrange another time?"
        )
        expect(fetch).toHaveBeenCalledTimes(1)
        expect(await db.select().from(coachUsage)).toEqual([
          expect.objectContaining({
            provider: "anthropic",
            model: COACH_MODEL,
          }),
        ])
      })
    } finally {
      setCoachModelEnv(previous)
      vi.unstubAllGlobals()
      vi.unstubAllEnvs()
      await client.close()
    }
  })
})
