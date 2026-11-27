import { afterEach, expect, it, vi } from "vitest"

import type { BlockId, LayoutPage } from "@workspace/domain/paper-doc"

import { paintThumbnail } from "./thumbnail.ts"

vi.mock("@workspace/paper-engine", () => {
  throw new Error("the card painter loaded the Paper engine")
})

afterEach(() => {
  vi.restoreAllMocks()
  document.body.replaceChildren()
})

const run = (x: number, text: string, font: string) => ({
  x,
  w: 9000 * text.length,
  text,
  from: 0,
  font,
  sizeMpt: 11000,
  color: "#000000",
  underline: false,
  strike: false,
  href: null,
})

const storedPage = (): LayoutPage => ({
  index: 0,
  size: { w: 595276, h: 841890 },
  content: { x: 56693, y: 56693, w: 481890, h: 728504 },
  boxes: [
    {
      kind: "line",
      block: "c1" as BlockId,
      rect: { x: 56693, y: 56693, w: 481890, h: 14950 },
      baseline: 68000,
      from: 0,
      to: 14,
      marker: null,
      segments: [
        run(56693, "Ada ", "liberation-sans-bold"),
        run(90000, "Wrenhollow", "liberation-serif-italic"),
      ],
    },
    {
      kind: "line",
      block: "c2" as BlockId,
      rect: { x: 56693, y: 72000, w: 481890, h: 14950 },
      baseline: 83000,
      from: 0,
      to: 5,
      marker: { text: "•", x: 50000, font: "carlito-regular", sizeMpt: 11000 },
      segments: [run(56693, "Skill", "liberation-mono-regular")],
    },
    {
      kind: "rule",
      block: "c3" as BlockId,
      rect: { x: 56693, y: 90000, w: 481890, h: 750 },
    },
  ],
})

function stage() {
  const el = document.createElement("div")
  document.body.append(el)
  return el
}

it("paints a stored first page without loading the Paper engine", () => {
  const card = stage()
  paintThumbnail(card, storedPage())
  expect(card.querySelectorAll(".paper-line")).toHaveLength(2)
  expect(card.querySelector(".paper-rule")).not.toBe(null)
  expect(card.style.width).toBe(`${595276 / 750}px`)
})

it("creates one element per box and run, and reads no layout", () => {
  const page = storedPage()
  const card = stage()
  const created = vi.spyOn(document, "createElement")
  const measured = vi.spyOn(Element.prototype, "getBoundingClientRect")
  paintThumbnail(card, page)
  const runs = 4
  const work = 1 + page.boxes.length + runs
  expect(card.querySelectorAll("*")).toHaveLength(work)
  expect(created.mock.calls.length).toBeLessThanOrEqual(work + 1)
  expect(measured).not.toHaveBeenCalled()
})

it("builds a page's lines once and copies them for every later card", () => {
  const page = storedPage()
  paintThumbnail(stage(), page)
  const again = stage()
  const created = vi.spyOn(document, "createElement")
  paintThumbnail(again, page)
  expect(created).not.toHaveBeenCalled()
  expect(again.querySelectorAll(".paper-run")).toHaveLength(4)
})

it("empties the card when it is erased", () => {
  const card = stage()
  const erase = paintThumbnail(card, storedPage())
  erase()
  expect(card.childElementCount).toBe(0)
})
