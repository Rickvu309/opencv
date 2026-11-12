import { withDatabase } from "../db/context.js"
import { user } from "../db/schema.js"
import { describe, expect, it } from "vitest"

import {
  backend,
  registerBackendHooks,
} from "../test/registry-formal-support.js"
import { coverageCases } from "./coverage-setup.js"
import {
  REVERSAL_EXPECT_PENDING,
  reversalExpectPendingExpired,
} from "./expect-pending.js"
import { staleExpectation } from "./expectation.js"

registerBackendHooks()

const FROZEN_PENDING = [
  "chat.rename",
  "chat.setFocus",
  "inbox.markDone",
  "inbox.snooze",
  "job.addChecklistItem",
  "job.create",
  "job.linkPaper",
  "job.setChecklistItem",
  "job.star",
  "job.update",
  "paper.attachPhoto",
  "paper.create",
  "paper.duplicate",
  "paper.edit",
  "paper.rename",
  "paper.replace",
  "paper.restore",
  "paper.setTemplate",
  "paper.share",
]

describe("the reversal expectation pending list", () => {
  it("only shrinks: it names no command outside the frozen set", () => {
    const added = REVERSAL_EXPECT_PENDING.commands.filter(
      (name) => !FROZEN_PENDING.includes(name)
    )
    expect(added, "commands added to the pending list").toEqual([])
    expect(new Set(REVERSAL_EXPECT_PENDING.commands).size).toBe(
      REVERSAL_EXPECT_PENDING.commands.length
    )
  })

  it("has not expired", () => {
    expect(
      reversalExpectPendingExpired(new Date()),
      `the pending list expired on ${REVERSAL_EXPECT_PENDING.expires}; bind the remaining commands to an expectation`
    ).toBe(false)
  })

  it("expires after its date and not before, on the injected day", () => {
    const day = REVERSAL_EXPECT_PENDING.expires
    const lastDay = new Date(`${day}T23:59:59Z`)
    const nextDay = new Date(lastDay.getTime() + 2000)
    expect(reversalExpectPendingExpired(lastDay)).toBe(false)
    expect(reversalExpectPendingExpired(nextDay)).toBe(true)
  })

  it("lists no command whose reversal already returns an expectation", async () => {
    await withDatabase(backend.db, async () => {
      const userId = "expect-pending-stale"
      await backend.db.insert(user).values({
        id: userId,
        name: "Ada",
        email: "ada-coverage@example.com",
      })
      const { cases } = coverageCases(backend.db, userId)
      const stale: string[] = []
      for (const row of cases) {
        await row.arrange()
        const result = await row.act()
        await row.assert(result)
        const listed = (
          REVERSAL_EXPECT_PENDING.commands as readonly string[]
        ).includes(row.name)
        if (listed && result.reversal?.expect) stale.push(row.name)
      }
      expect(stale, "listed commands that now return an expectation").toEqual(
        []
      )
    })
  }, 120_000)
})

describe("an expectation that matches no field", () => {
  it("refuses the undo instead of passing it", async () => {
    const answer = await staleExpectation(async () => ({ stage: "saved" }), {
      query: "job.get",
      input: {},
      matches: {},
      skipped: "Undo was skipped",
    })
    expect(answer).toBe("Undo was skipped")
  })
})
