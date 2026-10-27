import { afterEach, describe, expect, it } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { Dialog, DialogContent } from "@workspace/ui/components/dialog"

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
    expect(
      view.container.querySelector("[data-template-list]")?.className
    ).toContain("@min-[391px]:flex-row")
    expect(
      view.container.querySelector("[data-template-gallery]")?.className
    ).toContain("grid-cols-1")
    expect(
      view.container.querySelector("[data-template-gallery]")?.className
    ).toContain("@min-[391px]:grid-cols-2")
  })

  it("gives the dialog a wide frame that scrolls inside the viewport", () => {
    render(
      <Dialog open>
        <DialogContent>
          <PaperTemplateGallery
            onUse={() => undefined}
            onImport={() => undefined}
          />
        </DialogContent>
      </Dialog>
    )

    const content = document.querySelector("[data-slot='dialog-content']")
    expect(content?.className).toContain("sm:max-w-3xl")
    expect(content?.className).toContain("max-h-[90vh]")
    expect(content?.className).toContain("overflow-y-auto")
    expect(content?.className).not.toContain("sm:max-w-sm")
  })
})
