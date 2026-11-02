import assert from "node:assert/strict"
import test from "node:test"

import { designChecks } from "./design-checks.mjs"
import { loadSpec } from "./spec.mjs"
import { judged, stale, summarize, verdict } from "./verdict.mjs"

const spec = loadSpec()

test("the art, lockup and CTA checks are STALE on a page with none of them", () => {
  const out = designChecks({ ctas: {}, benefitArt: { count: 0 } }, spec)
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
  const out = designChecks(
    {
      ctas: {},
      benefitArt: { count: 0 },
      navLockup: { gap: 2, fontSize: "16px", fontWeight: "600" },
    },
    spec
  )
  assert.equal(out.find((r) => r.id === "28").status, "FAIL")
})

const wrongCta = {
  h: 20,
  fontSize: "13px",
  fontWeight: "500",
  padInline: 12,
  radius: 10,
  inset: true,
  outer: true,
}

test("29: a found wrong CTA FAILs although the others are missing; missing alone is STALE", () => {
  const out = designChecks(
    {
      ctas: { nav: wrongCta },
      benefitArt: { section: true, count: 0 },
    },
    spec
  ).find((r) => r.id === "29")
  assert.equal(out.status, "FAIL")
  assert.match(
    out.measured,
    /not judged: no button matched Get started in #close/
  )
  const none = designChecks({ ctas: {}, benefitArt: {} }, spec).find(
    (r) => r.id === "29"
  )
  assert.equal(none.status, "STALE")
})

test("27 and 30: #benefits present without its art is FAIL, only a missing #benefits is STALE", () => {
  const out = designChecks(
    {
      ctas: {},
      benefitArt: { section: true, count: 0 },
    },
    spec
  )
  for (const id of ["27", "30"])
    assert.equal(out.find((r) => r.id === id).status, "FAIL", id)
})

test("judged: a found FAIL wins over a missing part, a missing part alone is STALE", () => {
  assert.equal(judged("01", "a", "r", false, "bad", ["x"]).status, "FAIL")
  assert.match(
    judged("01", "a", "r", false, "bad", ["x"]).measured,
    /not judged: x/
  )
  assert.equal(judged("01", "a", "r", true, "ok", ["x"]).status, "STALE")
  assert.equal(judged("01", "a", "r", true, "ok").status, "PASS")
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
