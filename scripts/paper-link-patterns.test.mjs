import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { detect } from "./lib/paper-link-patterns.mjs"

test("link normalization refuses nested and overlapping repetitions and accepts split labels", () => {
  for (const pattern of [
    String.raw`/^[^\s@:/]+@[^\s@:/]+\.[^\s@:/]+$/`,
    String.raw`/^(?:[\p{L}\d-]+\.)+[\p{L}\d-]+(?::\d+)?(?:[/?#]|$)/u`,
    String.raw`/^(a+)+$/`,
    String.raw`/^(a+){2}$/`,
    String.raw`/^(a*)*$/`,
    String.raw`/^(a{1,}){1,}$/`,
    String.raw`/^[^.]+\.[^.]+$/`,
  ])
    assert.ok(
      detect(
        `function normalizeLinkHref(value) { return ${pattern}.test(value) }`
      ).length > 0
    )
  assert.deepEqual(
    detect(String.raw`
    const EMAIL_LABEL = /^[^\s@:/.]+$/
    const DOMAIN_LABEL = /^[\p{L}\d-]+$/u
    function normalizeLinkHref(value) { return value.split(".").every(label => DOMAIN_LABEL.test(label)) }
  `),
    []
  )
  assert.deepEqual(
    detect(
      readFileSync(
        new URL(
          "../packages/domain/src/paper-doc/rich-text.ts",
          import.meta.url
        ),
        "utf8"
      )
    ),
    []
  )
})
