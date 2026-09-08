// @vitest-environment jsdom
import { createElement } from "react"
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen, within } from "@testing-library/react"

import { PaperEditorToolbar } from "./paper-editor-toolbar.tsx"

afterEach(() => {
  cleanup()
})

const FORMAT_THEATER = ["Bold", "Italic", "Bullet list", "Numbered list"] as const

describe("PaperEditorToolbar", () => {
  it("keeps the CV strip to Undo/Redo, Insert, Template, and Export — no format theater", () => {
    render(
      createElement(PaperEditorToolbar, {
        variant: "cv",
        cvTemplateId: "product",
        onCvTemplateChange: () => undefined,
        onCvInsert: () => undefined,
      })
    )

    const toolbar = screen.getByRole("toolbar", { name: "CV tools" })
    expect(within(toolbar).getByRole("button", { name: "Undo" })).toBeDisabled()
    expect(within(toolbar).getByRole("button", { name: "Redo" })).toBeDisabled()
    expect(within(toolbar).getByRole("button", { name: "Insert" })).toBeInTheDocument()
    expect(within(toolbar).getByRole("button", { name: "Export" })).toBeInTheDocument()
    expect(
      within(toolbar).getByRole("button", { name: /Product & design/ })
    ).toBeInTheDocument()
    expect(within(toolbar).queryByRole("button", { name: "More options" })).not.toBeInTheDocument()

    for (const label of FORMAT_THEATER) {
      expect(
        within(toolbar).queryByRole("button", { name: label })
      ).not.toBeInTheDocument()
    }
  })

  it("still offers real formatting on Letter rich text", () => {
    render(createElement(PaperEditorToolbar, { variant: "letter" }))

    const toolbar = screen.getByRole("toolbar", { name: "Letter tools" })
    expect(within(toolbar).getByRole("button", { name: "Undo" })).toBeInTheDocument()
    expect(within(toolbar).getByRole("button", { name: "Redo" })).toBeInTheDocument()
    expect(within(toolbar).getByRole("button", { name: "Bold" })).toBeInTheDocument()
    expect(within(toolbar).getByRole("button", { name: "Insert" })).toBeInTheDocument()
    expect(within(toolbar).getByRole("button", { name: "Export" })).toBeInTheDocument()
  })

  it("enables CV Undo/Redo from structured history, not format theater", () => {
    const undos: string[] = []
    render(
      createElement(PaperEditorToolbar, {
        variant: "cv",
        cvTemplateId: "product",
        onCvTemplateChange: () => undefined,
        onCvInsert: () => undefined,
        canUndo: true,
        canRedo: true,
        onUndo: () => undos.push("undo"),
        onRedo: () => undos.push("redo"),
      })
    )
    const toolbar = screen.getByRole("toolbar", { name: "CV tools" })
    const undo = within(toolbar).getByRole("button", { name: "Undo" })
    const redo = within(toolbar).getByRole("button", { name: "Redo" })
    expect(undo).toBeEnabled()
    expect(redo).toBeEnabled()
    undo.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }))
    redo.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }))
    expect(undos).toEqual(["undo", "redo"])
  })
})
