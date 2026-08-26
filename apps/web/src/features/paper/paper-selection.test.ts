import { afterEach, describe, expect, it } from "vitest"

import { readPaperSelection } from "./paper-selection.ts"

afterEach(() => {
  document.body.innerHTML = ""
  window.getSelection()?.removeAllRanges()
})

describe("readPaperSelection", () => {
  it("reads a contenteditable selection and its section id", () => {
    const root = document.createElement("div")
    const field = document.createElement("div")
    field.setAttribute("data-paper-section", "summary")
    field.textContent = "Year-4 Information Systems student"
    root.append(field)
    document.body.append(root)

    const range = document.createRange()
    range.selectNodeContents(field)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)

    expect(readPaperSelection(root)).toEqual({
      text: "Year-4 Information Systems student",
      sectionId: "summary",
    })
  })

  it("reads an input selection", () => {
    const root = document.createElement("div")
    const input = document.createElement("input")
    input.setAttribute("data-paper-section", "proof-title")
    input.value = "Checkout card resize study"
    root.append(input)
    document.body.append(root)
    input.focus()
    input.setSelectionRange(0, 8)

    expect(readPaperSelection(root)).toEqual({
      text: "Checkout",
      sectionId: "proof-title",
    })
  })

  it("returns null when nothing is selected", () => {
    expect(readPaperSelection(document.body)).toBeNull()
  })
})
