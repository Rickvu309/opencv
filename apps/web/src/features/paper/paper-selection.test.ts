import { afterEach, describe, expect, it } from "vitest"

import {
  collapsePaperSelection,
  previewCoachSelectionText,
  readPaperSelection,
  retainCoachSelection,
} from "./paper-selection.ts"

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

describe("retainCoachSelection", () => {
  it("keeps the last non-empty selection when the live highlight is gone", () => {
    const previous = { text: "Ran weekly problem interviews", sectionId: "experience-0" }
    expect(retainCoachSelection(previous, null)).toEqual(previous)
  })

  it("replaces the held selection when the User highlights a new span", () => {
    const previous = { text: "old bullet", sectionId: "experience-0" }
    const next = { text: "new bullet", sectionId: "experience-1" }
    expect(retainCoachSelection(previous, next)).toEqual(next)
  })
})

describe("previewCoachSelectionText", () => {
  it("returns short text unchanged and truncates a long span", () => {
    expect(previewCoachSelectionText("Checkout")).toBe("Checkout")
    expect(previewCoachSelectionText("a".repeat(120)).length).toBe(96)
    expect(previewCoachSelectionText("a".repeat(120)).endsWith("…")).toBe(true)
  })
})

describe("collapsePaperSelection", () => {
  it("collapses a canvas highlight and leaves a composer outside the root alone", () => {
    const root = document.createElement("div")
    const field = document.createElement("div")
    field.contentEditable = "true"
    field.textContent = "Year-4 Information Systems student"
    root.append(field)
    const composer = document.createElement("textarea")
    composer.value = "Rewrite this"
    document.body.append(root, composer)

    const range = document.createRange()
    range.selectNodeContents(field)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
    expect(sel?.isCollapsed).toBe(false)

    composer.focus()
    composer.setSelectionRange(0, 7)
    collapsePaperSelection(root)
    expect(composer.selectionStart).toBe(0)
    expect(composer.selectionEnd).toBe(7)
    expect(window.getSelection()?.isCollapsed ?? true).toBe(true)
  })
})
