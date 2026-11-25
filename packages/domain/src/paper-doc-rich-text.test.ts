import assert from "node:assert/strict"
import { describe, it } from "node:test"

import * as fc from "fast-check"

import { normalizeLinkHref } from "./paper-doc/paper-presentation.ts"

import {
  isSafeHref,
  normalizeRuns,
  type SafeHref,
  type TextRun,
} from "./paper-doc/index.ts"

const HREFS = [
  undefined,
  "https://example.com/a",
  "mailto:lan@example.com",
  "https://example.com/(x)*y\\z",
] as const

it("normalizes website and email input through the safe href policy", () => {
  for (const [input, href] of [
    [" example.com/work ", "https://example.com/work"],
    ["linh@example.com", "mailto:linh@example.com"],
    ["http://example.com", "http://example.com"],
    ["https://example.com", "https://example.com"],
    ["example.com:8080/work?q=x#top", "https://example.com:8080/work?q=x#top"],
    ["münchen.example", "https://münchen.example"],
    ["first.last+cv@mail.example.com", "mailto:first.last+cv@mail.example.com"],
    ["mailto:linh@example.com", "mailto:linh@example.com"],
  ] as const)
    assert.equal(normalizeLinkHref(input), href)
  for (const input of [
    "javascript:alert(1)",
    "data:text/html,x",
    "ftp://example.com",
    "javascript:foo@example.com",
    "https://example.com/\u200b",
    "a@@example.com",
    "a@example..com",
    "a@.example.com",
    "example..com",
    "example.com:abc",
    "example.com:",
    "example.com:80:90",
    "a@localhost",
  ])
    assert.equal(normalizeLinkHref(input), undefined)
})

it("rejects 50,000-character adversarial input quickly on every link path", () => {
  const started = performance.now()
  for (const prefix of [
    "!@!.",
    "a@",
    "",
    "http://",
    "https://",
    "mailto:",
    "javascript:",
  ]) {
    const input = (prefix + "a.".repeat(25_000)).slice(0, 50_000)
    assert.equal(input.length, 50_000)
    assert.equal(normalizeLinkHref(input), undefined)
    assert.equal(isSafeHref(input), false)
    assert.deepEqual(
      normalizeRuns([{ text: "link", href: input as SafeHref }]),
      [{ text: "link" }]
    )
    assert.equal(normalizeLinkHref(" ".repeat(50_000) + input), undefined)
  }
  assert.ok(performance.now() - started < 1000)
})

const runArbitrary = fc.record({
  text: fc
    .array(
      fc.constantFrom("a", "b", "x", " ", "*", "\\", "[", "]", "(", ")", "\n"),
      {
        minLength: 1,
        maxLength: 8,
      }
    )
    .map((chars) => chars.join("")),
  bold: fc.boolean(),
  italic: fc.boolean(),
  href: fc.constantFrom(...HREFS),
})

const runsArbitrary = fc.array(runArbitrary, { maxLength: 6 }).map((records) =>
  normalizeRuns(
    records.map((record): TextRun => ({
      text: record.text,
      ...(record.bold ? { bold: true as const } : {}),
      ...(record.italic ? { italic: true as const } : {}),
      ...(record.href && isSafeHref(record.href) ? { href: record.href } : {}),
    }))
  )
)

describe("normalizeRuns", () => {
  it("drops empty runs and merges neighbours with equal marks", () => {
    const runs = normalizeRuns([
      { text: "a" },
      { text: "" },
      { text: "b" },
      { text: "c", bold: true },
      { text: "d", bold: true },
    ])
    assert.deepEqual(runs, [{ text: "ab" }, { text: "cd", bold: true }])
  })

  it("drops an unsafe href from a run and keeps the text", () => {
    const hrefs = [
      "javascript:alert(1)",
      "JaVaScRiPt:alert(1)",
      "  javascript:x",
      "\u0001data:text/html,x",
      "vbscript:x",
      "https:x.com",
      "https://\u202eexe.moc",
      "https://a.com/\u200b",
    ]
    for (const href of hrefs) {
      const runs = normalizeRuns([{ text: "a", href: href as SafeHref }])
      assert.deepEqual(runs, [{ text: "a" }], href)
    }
  })

  it("keeps http, https and mailto hrefs after trimming whitespace and control characters", () => {
    const runs = normalizeRuns([
      { text: "a", href: " \tHTTPS://example.com/x\n" as SafeHref },
      { text: "b", href: "\u0001mailto:lan@example.com" as SafeHref },
    ])
    assert.deepEqual(runs, [
      { text: "a", href: "HTTPS://example.com/x" },
      { text: "b", href: "mailto:lan@example.com" },
    ])
  })

  it("merges neighbours whose unsafe hrefs were dropped", () => {
    const runs = normalizeRuns([
      { text: "a" },
      { text: "b", href: "javascript:x" as SafeHref },
    ])
    assert.deepEqual(runs, [{ text: "ab" }])
  })

  it("is idempotent", () => {
    fc.assert(
      fc.property(runsArbitrary, (runs) => {
        assert.deepEqual(normalizeRuns(runs), runs)
      })
    )
  })
})

describe("inline markdown", () => {})
