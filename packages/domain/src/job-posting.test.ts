import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { generateKeyBetween } from "./job-position.ts"
import { openableApplyJobUrl } from "./job-posting.ts"

describe("openableApplyJobUrl", () => {
  it("returns a plain https url for a scheme-less paste", () => {
    assert.equal(
      openableApplyJobUrl(" jobs.acme.com/role/1 "),
      "https://jobs.acme.com/role/1"
    )
  })

  it("refuses the fake seed host, other schemes, spaces and oversize links", () => {
    for (const bad of [
      "https://jobs.example.com/x",
      "jobs.example.com",
      "ftp://acme.com/a",
      "https://acme.com/a b",
      `https://acme.com/${"a".repeat(2000)}`,
      "",
      null,
    ]) {
      assert.equal(openableApplyJobUrl(bad), null)
    }
  })
})

describe("generateKeyBetween", () => {
  it("treats a missing side as open-ended", () => {
    const first = generateKeyBetween(null, null)
    const after = generateKeyBetween(first, null)
    const before = generateKeyBetween(null, first)
    assert.ok(before < first && first < after)
  })

  it("lands strictly between two keys and refuses a reversed pair", () => {
    const a = generateKeyBetween(null, null)
    const c = generateKeyBetween(a, null)
    const b = generateKeyBetween(a, c)
    assert.ok(a < b && b < c)
    assert.throws(() => generateKeyBetween(c, a), RangeError)
  })
})
