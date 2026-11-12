import assert from "node:assert/strict"
import test from "node:test"

import { DESIGN_MAP } from "./design-map.mjs"
import { SCREENS } from "./screens.mjs"
import { SHOT_ONLY, shotOnlyProblems, unmappedMessage } from "./shot-only.mjs"

test("check names a reloaded Coach outcome as having no design frame instead of asking for rows", () => {
  const message = unmappedMessage([
    "coach-denied-reloaded",
    "paper-panel-receipt",
  ])
  assert.match(
    message,
    /^coach-denied-reloaded: no design frame for this screen \(.+\); it is shot-only, use node scripts\/ui\.mjs shot coach-denied-reloaded$/m
  )
  assert.match(
    message,
    /^no design rows for paper-panel-receipt; add rows to scripts\/ui\/design-map\.mjs$/m
  )
  assert.doesNotMatch(
    unmappedMessage(["paper-panel-receipt"]),
    /no design frame/
  )
})

test("every reloaded Coach outcome screen is shot-only", () => {
  assert.deepEqual(
    SCREENS.map((screen) => screen.id).filter((id) =>
      /^coach-.*-reloaded$/.test(id)
    ),
    Object.keys(SHOT_ONLY)
  )
})

test("a shot-only screen must be a screen without design rows", () => {
  assert.deepEqual(shotOnlyProblems(SHOT_ONLY, SCREENS, DESIGN_MAP), [])
  const mistake = shotOnlyProblems(
    { "coach-approval": "x", "coach-gone": "x" },
    SCREENS,
    DESIGN_MAP
  )
  assert.deepEqual(mistake, [
    "coach-approval: shot-only but has design rows; drop it from SHOT_ONLY",
    "coach-gone: shot-only but not a screen",
  ])
})
