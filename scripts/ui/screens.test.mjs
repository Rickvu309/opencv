import assert from "node:assert/strict"
import test from "node:test"
import { PROPERTIES } from "./compare.mjs"
import { DESIGN_MAP, rowsForScreen, validateDesignMap } from "./design-map.mjs"
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
  assert.deepEqual(validateDesignMap(DESIGN_MAP, PROPERTIES), [])
  const ids = new Set(SCREENS.map((screen) => screen.id))
  for (const row of DESIGN_MAP) assert.ok(ids.has(row.screen), row.label)
  assert.ok(rowsForScreen(DESIGN_MAP, "paper-panel-open").length > 0)
  assert.deepEqual(
    validateDesignMap(
      [
        {
          label: "x",
          screen: "s",
          selector: "a",
          frame: "f",
          props: ["depth"],
        },
      ],
      PROPERTIES
    ),
    ["x: unknown property depth"]
  )
})
