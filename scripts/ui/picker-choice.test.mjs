import assert from "node:assert/strict"
import test from "node:test"
import { unchosenPickerCards } from "./picker-choice.mjs"
import { SCREENS } from "./screens.mjs"

const OPEN_THE_PICKER = [
  { goto: "/paper" },
  { click: { role: "button", name: "New" } },
  { click: { role: "button", name: "CV" } },
]

test("MISTAKE: a blank CV recipe that presses Start blank on the default card fires", () => {
  assert.deepEqual(
    unchosenPickerCards([
      {
        id: "paper-blank",
        route: "/paper",
        steps: [
          ...OPEN_THE_PICKER,
          { click: { role: "button", name: "Start blank" } },
        ],
      },
    ]),
    [
      'paper-blank step 4 {"click":{"role":"button","name":"Start blank"}} confirms the picker on whatever card it opened on; click { role: "radio", name: "Blank" } first',
    ]
  )
})

test("MISTAKE: a choice made before the picker reopens does not count", () => {
  assert.equal(
    unchosenPickerCards([
      {
        id: "paper-home",
        route: "/paper",
        steps: [
          ...OPEN_THE_PICKER,
          { click: { role: "radio", name: "Modern" } },
          { click: { role: "button", name: "Use Modern" } },
          ...OPEN_THE_PICKER,
          { click: { role: "button", name: "Use Modern" } },
        ],
      },
    ]).length,
    1
  )
})

test("a recipe that chooses the card it confirms stays quiet", () => {
  assert.deepEqual(
    unchosenPickerCards([
      {
        id: "paper-blank",
        route: "/paper",
        steps: [
          ...OPEN_THE_PICKER,
          { click: { role: "radio", name: "Blank" } },
          { click: { role: "button", name: "Start blank" } },
        ],
      },
      {
        id: "paper-home",
        route: "/paper",
        steps: [
          ...OPEN_THE_PICKER,
          { click: { role: "radio", name: "Simple" } },
          { click: { role: "button", name: "Use Simple" } },
        ],
      },
    ]),
    []
  )
})

test("every screen recipe chooses the picker card it confirms", () => {
  assert.deepEqual(unchosenPickerCards(SCREENS), [])
})
