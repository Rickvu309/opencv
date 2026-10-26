import { afterEach, describe, expect, it } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"

import { PaperTemplateGallery } from "./paper-template-gallery.tsx"
import { PAPER_TEMPLATE_LABELS } from "./paper-templates.ts"

afterEach(() => {
  cleanup()
})

describe("Paper template gallery", () => {
  it("lists the sixteen templates and maps preview layouts", () => {
    const view = render(
      <PaperTemplateGallery
        onUse={() => undefined}
        onImport={() => undefined}
      />
    )

    for (const item of PAPER_TEMPLATE_LABELS) {
      expect(
        screen.getByRole("button", { name: item.label })
      ).toBeInTheDocument()
    }
    expect(PAPER_TEMPLATE_LABELS).toHaveLength(16)

    function preview(label: string) {
      fireEvent.click(screen.getByRole("button", { name: label }))
      return view.container
        .querySelector("[data-template]")
        ?.getAttribute("data-template")
    }

    expect(preview("Simple")).toBe("simple")
    expect(preview("Modern")).toBe("modern")
    expect(preview("Compact")).toBe("compact")
    expect(preview("Academic")).toBe("academic")
    expect(preview("With photo")).toBe("with-photo")
    expect(preview("Bold")).toBe("simple")
    expect(
      view.container.querySelector("[data-template-list]")?.className
    ).toContain("flex-col")
  })
})
