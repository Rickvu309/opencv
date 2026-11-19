import { afterEach, describe, expect, it } from "vitest"
import { cleanup, fireEvent, screen } from "@testing-library/react"
import { render } from "@/test/render-with-client.tsx"

import { Dialog, DialogContent } from "@workspace/ui/components/dialog"

import {
  PAPER_GALLERY_DIALOG_CLASS,
  PaperTemplateGallery,
} from "./paper-template-gallery.tsx"
import { TEMPLATE_CHOICES } from "./paper-template-pages.ts"

afterEach(() => {
  cleanup()
})

function openChooser() {
  render(
    <Dialog open>
      <DialogContent className={PAPER_GALLERY_DIALOG_CLASS}>
        <PaperTemplateGallery
          title="New CV"
          description="Pick a page, or bring a file you already have."
          onUse={() => undefined}
          onBlank={() => undefined}
          onImport={() => undefined}
        />
      </DialogContent>
    </Dialog>
  )
}

const LAYOUT_HEADINGS: Record<string, string[]> = {
  simple: ["Summary", "Experience", "Education", "Skills"],
  modern: ["Profile", "Experience", "Selected work"],
  compact: ["Work experience", "About", "Education", "Skills"],
  academic: [
    "Education",
    "Projects & campus",
    "Experience",
    "Skills & languages",
  ],
}

function contentPreview() {
  return document.querySelector(
    '[data-slot="paper-picker-preview"][data-visible="true"]'
  )
}

describe("Paper template chooser layout", () => {
  it("shows a distinct page and its headings for every template", () => {
    openChooser()
    const grid = screen.getByRole("radiogroup", { name: "Templates" })
    expect(
      [...grid.querySelectorAll<HTMLElement>("[data-template-card]")].map(
        (card) => card.dataset.templateCard
      )
    ).toEqual(["blank", "simple", "modern", "compact", "academic"])
    expect(
      grid.querySelector('[data-template-page="blank"]')
    ).toBeEmptyDOMElement()
    for (const [id, headings] of Object.entries(LAYOUT_HEADINGS)) {
      const page = grid.querySelector(`[data-template-page="${id}"]`)
      expect(page, id).toBeTruthy()
      expect(
        [...page!.querySelectorAll("[data-page-heading]")].map(
          (heading) => heading.textContent
        ),
        id
      ).toEqual(headings)
    }
    expect(screen.getByRole("radio", { name: "Simple" })).toHaveAttribute(
      "aria-checked",
      "true"
    )
    for (const choice of TEMPLATE_CHOICES) {
      fireEvent.click(screen.getByRole("radio", { name: choice.label }))
      expect(screen.getByText(choice.use)).toBeInTheDocument()
      expect(contentPreview()).toHaveAttribute("data-preview", choice.id)
      expect(
        screen.getByRole("button", { name: `Use ${choice.label}` })
      ).toBeEnabled()
    }
  })

  it("keeps the actions in a row of their own below the scrolling grid, so they stay in view however far the grid scrolls", () => {
    openChooser()
    const content = document.querySelector<HTMLElement>(
      "[data-slot='dialog-content']"
    )!
    const scroll = content.querySelector<HTMLElement>("[data-template-scroll]")
    const actions = content.querySelector<HTMLElement>(
      "[data-slot=paper-gallery-actions]"
    )
    expect(scroll?.className).toContain("min-h-0")
    expect(actions?.className).toContain("shrink-0")
    expect(scroll?.contains(actions)).toBe(false)
    expect(actions?.compareDocumentPosition(scroll!)).toBe(
      Node.DOCUMENT_POSITION_PRECEDING
    )
    expect(content.className).toContain("flex-col")
    expect(actions?.querySelector("[data-variant=primary]")?.textContent).toBe(
      "Use Simple"
    )
  })
})
