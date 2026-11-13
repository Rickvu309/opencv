import assert from "node:assert/strict"
import test from "node:test"
import { validateSpec } from "./annotate.mjs"
import {
  ARROWS_PER_IMAGE,
  draftSpec,
  rankChanges,
  shorthand,
} from "./changes.mjs"

const element = (key, extra = {}) => ({
  key,
  selector: key,
  slot: key,
  parent: null,
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  radius: 0,
  padding: [0, 0, 0, 0],
  gap: 0,
  fontSize: 14,
  fontWeight: "400",
  color: "rgb(0, 0, 0)",
  background: "rgba(0, 0, 0, 0)",
  border: "none",
  opacity: "1",
  ...extra,
})

const PANEL_BEFORE = [
  element("panel", { x: 1023, y: 251, width: 400, height: 600, radius: 12 }),
  element("list", {
    parent: "panel",
    x: 1023,
    y: 299,
    width: 400,
    height: 480,
    padding: [32, 24, 32, 24],
    gap: 24,
  }),
  element("composer", {
    parent: "panel",
    x: 1031,
    y: 790,
    width: 384,
    height: 54,
    radius: 18,
  }),
  element("title", { parent: "panel", x: 1039, y: 263 }),
]
const PANEL_AFTER = [
  element("panel", { x: 1020, y: 252, width: 400, height: 600, radius: 12 }),
  element("list", {
    parent: "panel",
    x: 1020,
    y: 300,
    width: 400,
    height: 480,
    padding: [8, 18, 8, 18],
    gap: 14,
  }),
  element("composer", {
    parent: "panel",
    x: 1028,
    y: 791,
    width: 384,
    height: 54,
    radius: 14,
  }),
  element("title", { parent: "panel", x: 1036, y: 264 }),
]

test("changes rank by size of change, notes carry both values, and children that only moved with their parent stay out", () => {
  const { changes, more, onlyBefore, onlyAfter } = rankChanges(
    PANEL_BEFORE,
    PANEL_AFTER
  )
  assert.deepEqual(
    changes.map((change) => change.note),
    [
      "list: padding 32 24 to 8 18; gap 24px to 14px",
      "composer: radius 18px to 14px",
      "panel: position 1023 251 to 1020 252",
    ]
  )
  assert.deepEqual(changes[2].before, {
    x: 1023,
    y: 251,
    width: 400,
    height: 600,
  })
  assert.deepEqual([more, onlyBefore, onlyAfter], [0, 0, 0])
})

test("padding prints as css shorthand, and a moved parent does not inflate a child's own move", () => {
  assert.deepEqual(
    [
      [8, 8, 8, 8],
      [8, 18, 8, 18],
      [24, 0, 0, 0],
      [1, 2, 3, 4],
      [4, 2, 0, 2],
    ].map(shorthand),
    ["8", "8 18", "24 0 0", "1 2 3 4", "4 2 0"]
  )
  const before = [
    element("shell", { x: 0 }),
    element("card", { parent: "shell", x: 1023 }),
  ]
  const after = [
    element("other", { x: 900 }),
    element("card", { parent: "other", x: 1020 }),
  ]
  const card = rankChanges(before, after).changes.find(
    (change) => change.key === "card"
  )
  assert.equal(card.score, 3)
})

test("style changes, unmatched elements and the cap of eight are reported without inventing a claim", () => {
  const before = Array.from({ length: 10 }, (_, at) =>
    element(`row-${at}`, { fontWeight: "400" })
  )
  const after = before.map((item, at) =>
    at < 9 ? { ...item, fontWeight: "600", color: "rgb(1, 1, 1)" } : item
  )
  after.push(element("added"))
  const result = rankChanges(before, after)
  assert.equal(result.changes.length, 8)
  assert.equal(result.more, 1)
  assert.equal(result.onlyAfter, 1)
  assert.equal(
    result.changes[0].note,
    "row-0: weight 400 to 600; color rgb(0, 0, 0) to rgb(1, 1, 1)"
  )
  assert.deepEqual(rankChanges(before, before).changes, [])
})

test("a draft spec numbers the largest findings per image, caps the arrows and keeps the rest as legend text", () => {
  const ranked = [
    {
      capture: { screen: "paper-panel-open", width: 1440 },
      result: rankChanges(PANEL_BEFORE, PANEL_AFTER),
    },
  ]
  const spec = draftSpec(ranked, { manifestPath: "manifest.json" })
  assert.equal(spec.manifest, "manifest.json")
  assert.deepEqual(spec.sections[0].callouts[0], {
    n: 1,
    note: "list: padding 32 24 to 8 18; gap 24px to 14px",
    target: { selector: "list" },
  })
  assert.deepEqual(validateSpec(spec), [])
  const many = Array.from({ length: 10 }, (_, at) =>
    element(`row-${at}`, { y: at * 40, fontSize: 14 })
  )
  const grown = many.map((item, at) => ({ ...item, fontSize: 14 + at + 1 }))
  const capped = draftSpec(
    [
      {
        capture: { screen: "s", width: 390 },
        result: rankChanges(many, grown),
      },
    ],
    { manifestPath: "m.json" }
  ).sections[0]
  assert.equal(capped.callouts.length, ARROWS_PER_IMAGE)
  assert.deepEqual(
    capped.callouts.map((callout) => callout.note.split(":")[0]),
    ["row-9", "row-8", "row-7", "row-6", "row-5", "row-4"]
  )
  assert.deepEqual(capped.also, [
    "row-3: font size 14px to 18px",
    "row-2: font size 14px to 17px",
    "2 more changed elements not listed",
  ])
})

test("an element on one side only becomes a new or removed callout, and its children stay out", () => {
  const before = [
    element("panel", { width: 400, height: 600 }),
    element("old-link", { parent: "panel", width: 120, height: 20 }),
  ]
  const after = [
    element("panel", { width: 400, height: 600 }),
    element("search", { parent: "panel", width: 200, height: 32 }),
    element("search-icon", { parent: "search", width: 16, height: 16 }),
  ]
  const result = rankChanges(before, after)
  assert.deepEqual(
    result.added.map((item) => item.key),
    ["search"]
  )
  assert.deepEqual(
    result.removed.map((item) => item.key),
    ["old-link"]
  )
  const [section] = draftSpec(
    [{ capture: { screen: "s", width: 1440 }, result }],
    { manifestPath: "m.json" }
  ).sections
  assert.deepEqual(
    section.callouts.map((callout) => [callout.note, callout.target]),
    [
      ["search: new, 200x32px", { after: { selector: "search" } }],
      ["old-link: removed, was 120x20px", { before: { selector: "old-link" } }],
    ]
  )
})
