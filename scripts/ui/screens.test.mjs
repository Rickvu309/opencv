import assert from "node:assert/strict"
import test from "node:test"
import { PROPERTIES } from "./compare.mjs"
import {
  APP_SHELL,
  DESIGN_MAP,
  isSameBox,
  rowsForScreen,
  validateDesignMap,
} from "./design-map.mjs"
import {
  SCREENS,
  pickScreens,
  shotName,
  validateScreens,
  viewportFor,
} from "./screens.mjs"

test("the screen registry is valid", () => {
  assert.deepEqual(validateScreens(SCREENS), [])
})

test("a screen with neither steps nor a reason, a duplicate, a bad route or an unknown step is refused", () => {
  const problems = validateScreens([
    { id: "a", route: "/a" },
    { id: "b", route: "/b", steps: [{ hover: "x" }] },
    { id: "b", route: "b", unreachable: "why" },
    { id: "C", route: "/c", steps: [], unreachable: "why" },
  ])
  assert.deepEqual(problems, [
    "a: needs steps or an unreachable reason, not both",
    'b: step {"hover":"x"} must be one of goto, click, fill, press, type, waitFor',
    "b: duplicate id",
    "b: route must start with /",
    "C: id must be kebab-case",
    "C: needs steps or an unreachable reason, not both",
  ])
})

test("screens are picked in the asked order and unknown ids are named", () => {
  const { found, missing } = pickScreens(SCREENS, [
    "paper-panel-open",
    "coach-home",
    "nope",
  ])
  assert.deepEqual(
    found.map((screen) => screen.id),
    ["paper-panel-open", "coach-home"]
  )
  assert.deepEqual(missing, ["nope"])
})

test("shot names and viewports are deterministic", () => {
  assert.equal(shotName("coach-home", 1440, 1), "coach-home-1440.png")
  assert.equal(shotName("coach-home", 390, 2), "coach-home-390@2x.png")
  assert.deepEqual(viewportFor(1440), { width: 1440, height: 900 })
  assert.deepEqual(viewportFor(390), { width: 390, height: 844 })
})

test("every design row names a known screen and known properties", () => {
  const ids = new Set(SCREENS.map((screen) => screen.id))
  assert.deepEqual(validateDesignMap(DESIGN_MAP, PROPERTIES, ids), [])
  assert.ok(rowsForScreen(DESIGN_MAP, "paper-panel-open").length > 0)
  assert.deepEqual(
    validateDesignMap(
      [
        {
          label: "x",
          screen: "s",
          selector: "a",
          frame: "f",
          composedScreen: "OC App shell",
          props: ["depth"],
        },
        { label: "y", screen: "s", selector: "a", frame: "f", props: ["x"] },
        {
          label: "z",
          kind: "same-box",
          screen: "s",
          against: "s",
          selector: "a",
          props: ["x"],
        },
        {
          label: "w",
          kind: "same-box",
          screen: "s",
          against: "gone",
          selector: "a",
          props: ["x"],
        },
      ],
      PROPERTIES,
      new Set(["s"])
    ),
    [
      "x: unknown property depth",
      "y: composedScreen is required",
      "z: against must be another screen",
      "w: unknown screen gone",
    ]
  )
})

test("every frame row belongs to the composed app shell screen", () => {
  const frameRows = DESIGN_MAP.filter((row) => !isSameBox(row))
  assert.ok(frameRows.length > 0)
  for (const row of frameRows)
    assert.equal(row.composedScreen, APP_SHELL, row.label)
})

test("the Coach card keeps the main content and the writing page where they were with the card closed", () => {
  const rows = DESIGN_MAP.filter(isSameBox)
  assert.deepEqual(
    rows.map((row) => [row.screen, row.against, row.props]),
    [
      ["paper-panel-open", "paper-panel-closed", ["x", "width"]],
      ["paper-panel-open", "paper-panel-closed", ["x", "width"]],
    ]
  )
  const closed = SCREENS.find((screen) => screen.id === "paper-panel-closed")
  assert.ok(Array.isArray(closed.steps))
})

test("a screen's after steps clean up and are only allowed on a screen with steps", () => {
  assert.deepEqual(
    validateScreens([
      { id: "a", route: "/a", steps: [], after: [{ click: { text: "x" } }] },
      { id: "b", route: "/b", unreachable: "why", after: [] },
      { id: "c", route: "/c", steps: [], after: [{ hover: "x" }] },
    ]),
    [
      "b: after must be a step list on a screen with steps",
      'c: step {"hover":"x"} must be one of goto, click, fill, press, type, waitFor',
    ]
  )
  for (const screen of SCREENS.filter((screen) =>
    JSON.stringify(screen.steps ?? []).includes('"Approve"')
  ))
    if (
      !JSON.stringify(screen.steps).includes(
        '"click":{"role":"button","name":"Approve"}'
      )
    )
      assert.ok(screen.after?.length, `${screen.id} leaves an edit waiting`)
})
