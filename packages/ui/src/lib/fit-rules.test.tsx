import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { fitProblems, type MeasuredBox } from "./fit-rules"

type Fixture = {
  from: string
  viewport: { width: number; height: number }
  modalOpen: boolean
  boxes: MeasuredBox[]
  fires?: string[]
}

const FIXTURES = path.join(import.meta.dirname, "fit-fixtures")
const fixtures = readdirSync(FIXTURES)
  .filter((name) => name.endsWith(".json"))
  .map((name) => ({
    name,
    ...(JSON.parse(readFileSync(path.join(FIXTURES, name), "utf8")) as Fixture),
  }))

const phone = { width: 390, height: 844 }
const page = (width = 390): MeasuredBox => ({
  kind: "document",
  name: "page",
  width,
  height: 844,
})
const surface = (over: Partial<MeasuredBox & { kind: "surface" }> = {}) =>
  ({
    kind: "surface",
    name: 'dialog "New CV"',
    x: 8,
    y: 40,
    width: 374,
    height: 600,
    pinned: true,
    reachable: false,
    ...over,
  }) as MeasuredBox
const control = (over: Partial<MeasuredBox & { kind: "control" }> = {}) =>
  ({
    kind: "control",
    name: 'button "Close"',
    x: 320,
    y: 48,
    width: 44,
    height: 44,
    pinned: true,
    hit: true,
    inModal: true,
    inline: false,
    ...over,
  }) as MeasuredBox

describe("fit rule 1: the document does not scroll sideways", () => {
  it("fires when content is wider than the window", () => {
    expect(fitProblems(phone, [page(412)], false)).toEqual([
      "the page scrolls sideways: content is 412px wide in a 390px window",
    ])
  })
  it("stays quiet at the window width", () => {
    expect(fitProblems(phone, [page(390)], false)).toEqual([])
  })
})

describe("fit rule 2: a pinned dialog, sheet, panel, bar or toast lies inside the window or can be scrolled to", () => {
  it("fires when a pinned box runs past the bottom", () => {
    expect(fitProblems(phone, [surface({ y: 0, height: 878 })], true)).toEqual([
      'dialog "New CV" runs off the window and cannot be scrolled into view: bottom 878 > 844',
    ])
  })
  it("stays quiet when its own scroller can reach the end", () => {
    expect(
      fitProblems(
        phone,
        [surface({ y: 0, height: 878, reachable: true })],
        true
      )
    ).toEqual([])
  })
  it("stays quiet for a box in the page flow, which the page scroll reaches", () => {
    expect(
      fitProblems(
        phone,
        [surface({ y: 700, height: 600, pinned: false })],
        false
      )
    ).toEqual([])
  })
})

describe("fit rule 3: a visible control is hit-testable at its centre", () => {
  it("fires when another box covers it", () => {
    expect(
      fitProblems(
        phone,
        [control({ hit: false, coveredBy: 'toast "Saved"', inModal: false })],
        false
      )
    ).toEqual([
      'button "Close" cannot be clicked: toast "Saved" covers its centre (342, 70)',
    ])
  })
  it("fires when a pinned control sits outside the window", () => {
    expect(
      fitProblems(
        phone,
        [control({ y: 850, hit: false, coveredBy: "outside the window" })],
        true
      )
    ).toEqual([
      'button "Close" is off screen: its centre (342, 872) is outside the 390x844 window',
    ])
  })
  it("stays quiet for a control behind an open modal it is not part of", () => {
    expect(
      fitProblems(
        phone,
        [control({ hit: false, coveredBy: "dialog overlay", inModal: false })],
        true
      )
    ).toEqual([])
  })
})

describe("fit rule 4: at 430px wide or less every target is 44 by 44", () => {
  it("fires on a 28px icon button on a phone", () => {
    expect(
      fitProblems(phone, [control({ width: 28, height: 28 })], false)
    ).toEqual(['button "Close" is 28x28, under the 44x44 phone target'])
  })
  it("stays quiet on the same button at 820px", () => {
    expect(
      fitProblems(
        { width: 820, height: 512 },
        [control({ width: 28, height: 28 })],
        false
      )
    ).toEqual([])
  })
  it("stays quiet on a link inside a line of text", () => {
    expect(
      fitProblems(
        phone,
        [control({ width: 60, height: 18, inline: true })],
        false
      )
    ).toEqual([])
  })
})

describe("fit rule 5: a dialog, sheet, panel, bar or toast is at least 1px tall", () => {
  it("fires when the box collapsed", () => {
    expect(
      fitProblems(
        { width: 1280, height: 117 },
        [surface({ name: 'panel "Coach"', y: 69, height: 0 })],
        false
      )
    ).toEqual(['panel "Coach" has collapsed to 0px tall'])
  })
})

describe("boxes measured on rounds that reviewers failed fire, and main's boxes stay quiet", () => {
  it("has a fixture for each recorded layout row and at least one from main", () => {
    expect(fixtures.filter((fixture) => fixture.fires).length).toBe(7)
    expect(
      fixtures.filter((fixture) => !fixture.fires).length
    ).toBeGreaterThanOrEqual(1)
  })
  for (const fixture of fixtures)
    it(`${fixture.name}: ${fixture.from}`, () => {
      const problems = fitProblems(
        fixture.viewport,
        fixture.boxes,
        fixture.modalOpen
      )
      if (!fixture.fires) {
        expect(problems).toEqual([])
        return
      }
      for (const expected of fixture.fires)
        expect(problems.join("\n")).toContain(expected)
    })
})

describe("fit rule 3 also covers a control cut off by a box that does not scroll", () => {
  it("fires on the Paper home card under an overflow-hidden main at 600x480", () => {
    expect(
      fitProblems(
        { width: 600, height: 480 },
        [
          control({
            name: 'button "CV.docx, just now"',
            x: 16,
            y: 436,
            width: 276,
            height: 40,
            pinned: false,
            hit: false,
            clippedBy: 'main "Paper"',
            inModal: false,
          }),
        ],
        false
      )
    ).toEqual([
      'button "CV.docx, just now" cannot be reached: main "Paper" cuts it off at its centre (154, 456) and does not scroll',
    ])
  })
})
