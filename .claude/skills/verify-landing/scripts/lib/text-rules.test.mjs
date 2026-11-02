import assert from "node:assert/strict"
import test from "node:test"

import { findMarketese, textRules } from "./text-rules.mjs"

test("04 catches each banned term, including #1 and possessive forms", () => {
  for (const [text, hit] of [
    ["We are the #1 coach", "#1"],
    ["#1 career coach", "#1"],
    ["Land your dream job", "dream"],
    ["Our best coach yet", "best"],
    ["Our seamless onboarding", "seamless"],
    ["The best coach", "best"],
    ["Supercharge your search", "Supercharge"],
  ]) {
    assert.deepEqual(findMarketese(text), [hit], text)
  }
})

test("04 exempts your best work, dream seat and fits best", () => {
  assert.deepEqual(findMarketese("Turn your best work into a page"), [])
  assert.deepEqual(findMarketese("Get your butt in your dream seat."), [])
  assert.deepEqual(findMarketese("which of your proof fits best"), [])
  assert.deepEqual(findMarketese("Show your best coach"), ["best"])
  assert.deepEqual(findMarketese("Land your dream job"), ["dream"])
  assert.deepEqual(findMarketese("Your best work, our best tool"), ["best"])
})

const block = (region, text, tag = "p") => ({ region, text, tag })
const base = (blocks, links = []) => ({
  blocks,
  links,
  description: "",
  title: "",
  bodyText: "",
  alts: [],
  imgs: [],
  markup: { blockquote: 0, logoImgs: 0 },
})
const verdictOf = (top, id) => textRules(top).find((r) => r.id === id)
const passOf = (top, id) => verdictOf(top, id).status === "PASS"

test("10 needs the objection above the first surface in DOM order", () => {
  const objection = block("section", "Answers come from your own CV and goals.")
  const surface = block("surface:coach", "Coach", "h2")
  assert.equal(
    passOf(base([block("hero", "Hi"), objection, surface]), "10"),
    true
  )
  assert.equal(
    passOf(base([block("hero", "Hi"), surface, objection]), "10"),
    false
  )
  assert.equal(passOf(base([block("hero", "Hi"), surface]), "10"), false)
})

test("10 is STALE, not FAIL, when no surface block exists", () => {
  const found = verdictOf(base([block("hero", "Hi")]), "10")
  assert.equal(found.status, "STALE")
  assert.match(found.measured, /surface:/)
})

test("08 accepts short labels with an object and rejects bare verbs", () => {
  const link = (text) => [
    { region: "nav", text, href: "/sign-in" },
    { region: "hero", text, href: "/sign-in" },
    { region: "closing", text, href: "/sign-in" },
  ]
  const label = (text) => passOf(base([], link(text)), "08")
  assert.equal(label("Start learning"), true)
  assert.equal(label("Find food"), true)
  assert.equal(label("Get started"), true)
  for (const bad of ["Start free", "Learn more", "Join", "Try now"])
    assert.equal(label(bad), false, bad)
})

test("07 tells a sign-up label from Log in on the shared /sign-in route", () => {
  const links = [
    { region: "nav", text: "Log in", href: "/sign-in" },
    { region: "nav", text: "Get started", href: "/sign-in" },
    { region: "closing", text: "Get started", href: "/sign-in" },
  ]
  assert.equal(passOf(base([], links), "07"), true)
})

test("02 needs a block that names opencv and a CV", () => {
  const page = (text) => base([block("section", text)])
  assert.equal(
    passOf(
      page(
        "opencv helps you say it properly: clear proof of your work, then a CV."
      ),
      "02"
    ),
    true
  )
  assert.equal(passOf(page("Get your butt in your dream seat."), "02"), false)
})

test("03, 06 and 11 are FAIL, not STALE, when the hero subhead or a product title or intro is gone", () => {
  const out = textRules(base([block("hero", "Hi", "h1")]))
  for (const id of ["03", "06", "11"])
    assert.equal(out.find((r) => r.id === id).status, "FAIL", id)
  assert.match(out.find((r) => r.id === "06").measured, /no h2/)
})

test("06 judges the titles it found: a long one FAILs next to a missing one", () => {
  const out = textRules(
    base([block("surface:paper", "One two three four five", "h2")])
  ).find((r) => r.id === "06")
  assert.equal(out.status, "FAIL")
  assert.match(out.measured, /paper->"One two three four five"/)
})
