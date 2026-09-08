import { readFileSync } from "node:fs"
import path from "node:path"
import { createElement, useState } from "react"
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"

import {
  CvDocument,
  EditableField,
  PAPER_CANVAS_FIELD_CLASS,
} from "./paper-cv-document.tsx"
import { applyCvTemplate } from "./paper-cv-template-picker.tsx"
import {
  CV_TEMPLATES,
  CV_TYPE_ROLES,
  defaultCvData,
  type CvTemplateId,
} from "./paper-cv-types.ts"

afterEach(() => {
  cleanup()
})

const paperCss = readFileSync(
  path.join(process.cwd(), "src/styles/paper.css"),
  "utf8"
)

function renderCv(templateId: CvTemplateId) {
  function Harness() {
    const [data, setData] = useState(() =>
      applyCvTemplate(defaultCvData(), templateId)
    )
    return createElement(CvDocument, { data, onChange: setData })
  }
  return render(createElement(Harness))
}

describe("CV print-paper type rhythm", () => {
  it("marks ADR-0010 roles on every default template", () => {
    for (const template of CV_TEMPLATES) {
      cleanup()
      renderCv(template.id)

      for (const role of CV_TYPE_ROLES) {
        expect(
          document.querySelector(`[data-cv-type="${role}"]`),
          `${template.name} is missing ${role}`
        ).not.toBeNull()
      }

      const name = screen.getByRole("textbox", { name: "Full name" })
      expect(name.closest("[data-cv-type='page-title']")).not.toBeNull()

      const headline = screen.getByRole("textbox", { name: "Headline" })
      expect(headline.closest("[data-cv-type='body']")).not.toBeNull()
    }
  })
})

describe("EditableField canvas chrome (QVE-206)", () => {
  it("uses quiet paper-canvas chrome instead of a heavy form field", () => {
    render(
      createElement(EditableField, {
        "aria-label": "Summary",
        value: "A short summary",
        onChange: () => {},
      })
    )
    const field = screen.getByRole("textbox", { name: "Summary" })
    expect(field).toHaveClass(PAPER_CANVAS_FIELD_CLASS)
    expect(field).toHaveAttribute("data-paper-canvas-field")
    expect(field.className).not.toMatch(/bg-muted\/80/)
    expect(field.className).not.toMatch(/border-input/)
    expect(field.className).not.toMatch(/focus:ring-1/)
    expect(field.className).not.toMatch(/rounded-full/)
  })

  it("shows focus on click and clears on blur and Escape", () => {
    render(
      createElement(EditableField, {
        "aria-label": "Bullet point",
        value: "Ran weekly café shifts",
        onChange: () => {},
        multiline: true,
      })
    )
    const field = screen.getByRole("textbox", { name: "Bullet point" })

    fireEvent.click(field)
    field.focus()
    expect(field).toHaveFocus()

    field.blur()
    expect(field).not.toHaveFocus()

    field.focus()
    expect(field).toHaveFocus()
    fireEvent.keyDown(field, { key: "Escape" })
    expect(field).not.toHaveFocus()
  })
})

describe("paper canvas field CSS (QVE-206)", () => {
  it("uses kit ring + muted wash, not cite-jump info or Coach pills", () => {
    expect(paperCss).toMatch(/\.paper-canvas-field:focus/)
    expect(paperCss).toMatch(/var\(--muted\)/)
    expect(paperCss).toMatch(/var\(--ring\)/)
    expect(paperCss).toMatch(/\.paper-canvas-field::selection/)
    expect(paperCss).toMatch(/currentColor/)

    const start = paperCss.indexOf(".paper-canvas-field {")
    const end = paperCss.indexOf("QVE-186")
    const chrome = paperCss.slice(start, end).replace(/\/\*[\s\S]*?\*\//g, "")
    expect(chrome).toContain(".paper-canvas-field:focus")
    expect(chrome).toContain("var(--muted)")
    expect(chrome).toContain("var(--ring)")
    expect(chrome).not.toMatch(/var\(--info\)/)
    expect(chrome).not.toMatch(/rounded-full/)
    expect(chrome).not.toMatch(/bg-muted\/70/)
  })
})
