import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"

import { loadInboxFixture } from "./inbox/index.ts"

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../apps/api/fixtures/inbox.json"
)

const W2_PAIRS = [
  ["Regional bank", "Business Analyst"],
  ["Local startup", "Associate PM"],
  ["Lumière", "Marketing Executive"],
  ["Fintech app", "Growth Marketer"],
  ["Agency", "Content Specialist"],
  ["E-commerce co.", "Product Analyst"],
] as const

describe("loadInboxFixture", () => {
  const threads = loadInboxFixture(
    JSON.parse(readFileSync(fixturePath, "utf8"))
  )

  it("returns the six W2.3 threads", () => {
    assert.equal(threads.length, 6)
    assert.deepEqual(
      threads.map((thread) => [thread.company, thread.role]),
      W2_PAIRS.map((pair) => [...pair])
    )
  })

  it("gives the interview suggestion and the draft to different threads", () => {
    const suggested = threads.filter(
      (thread) => thread.suggestedStage === "interview"
    )
    const drafted = threads.filter((thread) => thread.draft)
    assert.equal(suggested.length, 1)
    assert.equal(suggested[0]?.id, "local-startup")
    assert.equal(drafted.length, 1)
    assert.equal(drafted[0]?.id, "regional-bank")
    assert.match(drafted[0]?.draft?.body ?? "", /14:30/)
  })
})
