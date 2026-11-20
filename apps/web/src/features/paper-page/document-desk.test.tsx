import { afterEach, expect, it, vi } from "vitest"
import { cleanup, screen, waitFor, within } from "@testing-library/react"
import { render } from "@/test/render-with-client.tsx"
import {
  PaperDocumentCanvas,
  PaperDocumentHeader,
  PaperDocumentRuler,
  PaperDocumentTitle,
} from "./document-chrome.tsx"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it("renders the editable name in the breadcrumb when the page title moves to the header", () => {
  render(
    <PaperDocumentHeader
      name="My CV"
      status="Saved"
      editedAt={null}
      editableName={<PaperDocumentTitle name="My CV" docId="invalid" />}
    />
  )
  const crumb = screen.getByRole("navigation", { name: "Breadcrumb" })
  expect(within(crumb).getByRole("heading", { name: "My CV" })).toBeVisible()
  expect(screen.getAllByText("My CV")).toHaveLength(1)
})

it("marks the ruler to the page width in centimetres", async () => {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 0, 816, 1056)
  )
  const view = render(
    <PaperDocumentCanvas ruler={<PaperDocumentRuler />}>
      <div data-paper-page-viewport>
        <article className="paper-rich-sheet" style={{ padding: 96 }} />
      </div>
    </PaperDocumentCanvas>
  )
  await waitFor(() =>
    expect(
      view.container.querySelector('[data-slot="paper-ruler"]')
    ).not.toBeNull()
  )
  const ruler = view.container.querySelector(
    '[data-slot="paper-ruler"]'
  ) as HTMLElement
  expect(ruler).toHaveStyle({ width: "816px" })
  expect(ruler.querySelectorAll("[data-paper-ruler-number]")).toHaveLength(21)
  expect(ruler.querySelector('[data-paper-ruler-tick="minor"]')).not.toBeNull()
})
