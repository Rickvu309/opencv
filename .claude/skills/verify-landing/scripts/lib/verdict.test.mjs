// A locator that matches nothing must report STALE. Run: node --test .claude/skills/verify-landing/scripts/lib
import assert from "node:assert/strict"
import test from "node:test"

import { designChecks } from "./design-checks.mjs"
import { stale, summarize, verdict } from "./verdict.mjs"

test("the art, lockup and CTA checks are STALE on a page with none of them", () => {
  const out = designChecks({ ctas: {}, benefitArt: { count: 0 } })
  assert.deepEqual(
    out.map((r) => [r.id, r.status]),
    [
      ["27", "STALE"],
      ["28", "STALE"],
      ["29", "STALE"],
      ["30", "STALE"],
    ]
  )
  assert.match(out[2].measured, /Get started in the header/)
})

test("a found element is still judged, so a wrong lockup is FAIL", () => {
  const out = designChecks({
    ctas: {},
    benefitArt: { count: 0 },
    navLockup: { gap: 2, fontSize: "16px", fontWeight: "600" },
  })
  assert.equal(out.find((r) => r.id === "28").status, "FAIL")
})

test("summary and exit code: STALE is 3, FAIL is 1, all PASS is 0", () => {
  const pass = verdict("01", "a", "rule", true, "ok")
  const fail = verdict("02", "b", "rule", false, "bad")
  const gone = stale("03", "c", "no h1 matched", "rule")
  const mixed = summarize([pass, fail, gone])
  assert.equal(mixed.exit, 3)
  assert.equal(mixed.lines.at(-1), "1 PASS, 1 FAIL, 1 STALE: 02 03")
  assert.equal(summarize([pass, fail]).exit, 1)
  assert.equal(summarize([pass]).exit, 0)
  assert.equal(summarize([pass]).lines.at(-1), "1 PASS, 0 FAIL, 0 STALE")
})
