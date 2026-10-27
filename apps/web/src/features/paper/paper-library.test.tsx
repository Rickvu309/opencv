import { afterEach, describe, expect, it } from "vitest"
import { cleanup, fireEvent, screen } from "@testing-library/react"
import { render } from "@/test/render-with-client.tsx"
import { emptyCvDocument, type PaperView } from "@workspace/domain"

import { PaperLibrary } from "./paper-library.tsx"

function cv(name: string): PaperView {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name,
    kind: "cv",
    templateId: "simple",
    status: "draft",
    document: emptyCvDocument(),
    contentVersion: 1,
    checks: [],
    pageChoice: "unset",
    sourceFileId: null,
    createdAt: "2026-08-25T12:00:00.000Z",
    updatedAt: "2026-08-25T12:00:00.000Z",
  }
}

afterEach(() => {
  cleanup()
})

function renderLibrary(docs: PaperView[]) {
  render(
    <PaperLibrary
      docs={docs}
      files={[]}
      loading={false}
      error={null}
      onRetry={() => undefined}
      onOpen={() => undefined}
    />
  )
}

describe("Paper library", () => {
  it("shows the three start cards and the import row when there are no documents", () => {
    renderLibrary([])
    expect(screen.getByText("Start a document")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "CV" })).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Cover letter" })
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Proof" })).toHaveAttribute(
      "href",
      "/app/proof"
    )
    expect(
      screen.getByRole("button", { name: "Choose file" })
    ).toBeInTheDocument()
  })

  it("names a CV card from the document and hides it when search misses", async () => {
    renderLibrary([cv("PM track CV")])
    expect(
      screen.getByRole("button", { name: /^PM track CV,/ })
    ).toBeInTheDocument()

    fireEvent.change(screen.getByRole("textbox", { name: "Search Paper" }), {
      target: { value: "portfolio" },
    })

    expect(screen.getByText('No results for "portfolio"')).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /^PM track CV,/ })
    ).not.toBeInTheDocument()
    expect(
      screen.getByText("Try another word, or clear the search.")
    ).toBeInTheDocument()
  })

  it("exposes Rename and Delete on the card menu", async () => {
    renderLibrary([cv("PM track CV")])
    fireEvent.click(screen.getByRole("button", { name: "PM track CV menu" }))
    const menu = await screen.findByRole("menu")
    expect(menu).toHaveTextContent("Rename")
    expect(menu).toHaveTextContent("Delete")
  })
})
