import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { keywordGap } from "./paper.ts"

describe("keywordGap", () => {
  it("returns the first uppercase token the letter does not contain", () => {
    const gap = keywordGap(
      "I shipped ads last year.",
      "The role needs Meta Ads"
    )
    assert.deepEqual(gap, {
      keyword: "Meta Ads",
      sentence: "The job asks for Meta Ads. Add it if you've used it.",
    })
  })

  it("keeps a whole capitalised phrase, not its first word", () => {
    assert.equal(
      keywordGap("I ran Meta campaigns.", "needs Google Analytics 4 and Meta")
        ?.keyword,
      "Google Analytics"
    )
    assert.equal(
      keywordGap("I used Meta Ads.", "The role needs Meta Ads"),
      null
    )
    assert.equal(keywordGap("", "Strong Figma skills")?.keyword, "Strong Figma")
  })

  it("skips stop words, short tokens, and words already in the letter", () => {
    assert.equal(keywordGap("I know SQL.", "Go and SQL for your team"), null)
    assert.equal(keywordGap("Built the pipeline.", "and for with your"), null)
  })

  it("returns null when the posting has no gap", () => {
    assert.equal(
      keywordGap("I used Meta Ads and SQL.", "Meta Ads and SQL experience"),
      null
    )
  })
})
