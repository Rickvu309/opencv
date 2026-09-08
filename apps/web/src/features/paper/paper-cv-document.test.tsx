// @vitest-environment jsdom
import { createElement, useState } from "react"
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"

import { CvDocument } from "./paper-cv-document.tsx"
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

      const summary = screen.getByRole("textbox", { name: "Summary" })
      expect(summary.closest("[data-cv-type='body']")).not.toBeNull()
    }
  })
})
