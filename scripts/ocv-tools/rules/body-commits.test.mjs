import assert from "node:assert/strict"
import test from "node:test"
import { decide } from "./index.mjs"

function check(note, isCommitReachable) {
  const text = [
    "**Now:** The body checks its proof.",
    "**Proof:** `node --test`: 1 pass.",
    "",
    note,
  ].join("\n")
  return decide("body", {
    body: { file: "body.md", text, isCommitReachable },
    pull: { title: "chore: check proof (#91)" },
    migrations: { files: [] },
    diff: { files: [] },
  }).refusals.map(({ id, message }) => ({ id, message }))
}

test("body accepts a main hash and a branch hash", () => {
  const reachable = new Set(["af12345", "b234567"])
  assert.deepEqual(
    check("Measured at AF12345 and on `b234567`.", (hash) =>
      reachable.has(hash)
    ),
    []
  )
})

test("body refuses each unreachable citation at its original line", () => {
  assert.deepEqual(
    check(
      [
        "<details><summary>Detail</summary>",
        "",
        "Measured at ab12345 on cd23456.",
        "Baseline head ef34567, commit f456789.",
        "</details>",
        "",
        "**Introduced by:** c567890",
      ].join("\n"),
      () => false
    ),
    [
      {
        id: "BAD_BODY",
        message:
          "5 problems. (1) Line 6 cites commit ab12345, which is on neither this branch nor origin/main. Measure again at the head or drop the hash. (2) Line 6 cites commit cd23456, which is on neither this branch nor origin/main. Measure again at the head or drop the hash. (3) Line 7 cites commit ef34567, which is on neither this branch nor origin/main. Measure again at the head or drop the hash. (4) Line 7 cites commit f456789, which is on neither this branch nor origin/main. Measure again at the head or drop the hash. (5) Line 10 cites commit c567890, which is on neither this branch nor origin/main. Measure again at the head or drop the hash.",
      },
    ]
  )
})

test("body ignores hashes in fenced code and numbers with no hex letters", () => {
  assert.deepEqual(
    check(
      [
        "~~~sh",
        "git log at `ab12345`",
        "~~~",
        "```text",
        "Introduced by: cd23456",
        "```",
        "Counted on 1234567 and at `2345678`.",
      ].join("\n"),
      (hash) => assert.fail(`Unexpected commit lookup for ${hash}`)
    ),
    []
  )
})
