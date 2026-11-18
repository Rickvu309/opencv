import { afterEach, describe, expect, it } from "vitest"
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterContextProvider,
} from "@tanstack/react-router"

import { render } from "@/test/render-with-client.tsx"
import { PaperLibrary } from "./paper-library.tsx"
import { cv, letter, renderLibrary } from "./paper-library.fixtures.tsx"

function proofsRouter() {
  const root = createRootRoute()
  const proofs = createRoute({
    getParentRoute: () => root,
    path: "/proofs",
    component: () => null,
  })
  return createRouter({
    routeTree: root.addChildren([proofs]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  })
}

afterEach(() => {
  cleanup()
})

describe("Paper home sections", () => {
  it("groups documents into sections and searches across every section", () => {
    renderLibrary([cv("My CV"), letter("Design letter")])
    expect(
      screen.queryByRole("group", { name: "Document type" })
    ).not.toBeInTheDocument()
    const cvs = screen.getByRole("region", { name: "CVs" })
    const letters = screen.getByRole("region", { name: "Letters" })
    expect(
      within(cvs).getByRole("button", { name: /^My CV,/ })
    ).toBeInTheDocument()
    expect(
      within(letters).getByRole("button", { name: /^Design letter,/ })
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole("region", { name: "Files" })).getAllByRole(
        "button",
        { name: "Import a file" }
      )[0]!
    ).toBeInTheDocument()
    fireEvent.change(screen.getByRole("searchbox", { name: "Search Paper" }), {
      target: { value: "design" },
    })
    expect(
      screen.queryByRole("region", { name: "CVs" })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /^Design letter,/ })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: "Open Proofs" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "New letter" })
    ).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole("searchbox", { name: "Search Paper" }), {
      target: { value: "nothing" },
    })
    expect(screen.getByText('No results for "nothing"')).toBeInTheDocument()
    const empty = screen.getByRole("status")
    expect(empty).toHaveTextContent("Try another word, or clear the search.")
    fireEvent.keyDown(screen.getByRole("searchbox", { name: "Search Paper" }), {
      key: "Escape",
    })
    expect(screen.getByRole("searchbox", { name: "Search Paper" })).toHaveValue(
      ""
    )
    expect(screen.getByRole("region", { name: "CVs" })).toBeInTheDocument()
    fireEvent.change(screen.getByRole("searchbox", { name: "Search Paper" }), {
      target: { value: "nothing" },
    })
    fireEvent.click(
      within(screen.getByRole("status")).getByRole("button", {
        name: "Clear search",
      })
    )
    expect(screen.getByRole("searchbox", { name: "Search Paper" })).toHaveValue(
      ""
    )
    expect(screen.getByRole("region", { name: "CVs" })).toBeInTheDocument()
  })

  it("keeps the header to the title, search and New", () => {
    renderLibrary([cv("My CV")])
    expect(screen.getByRole("heading", { name: "Paper" })).toHaveTextContent(
      /^Paper$/
    )
    expect(
      screen.queryByRole("button", { name: "Import", exact: true })
    ).not.toBeInTheDocument()
    fireEvent.click(
      screen.getAllByRole("button", { name: "Import a file" })[0]!
    )
    expect(
      screen.getByRole("dialog", { name: "Import", exact: true })
    ).toBeInTheDocument()
  })

  it("filters the library by view and keeps counts for the other kinds", () => {
    renderLibrary([cv("My CV"), letter("Design letter")])
    const views = within(screen.getByRole("group", { name: "Library views" }))
    const letters = views.getByRole("button", { name: /Letters ?1/ })
    fireEvent.click(letters)
    expect(letters).toHaveAttribute("aria-pressed", "true")
    expect(
      screen.queryByRole("region", { name: "CVs" })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /^Design letter,/ })
    ).toBeInTheDocument()
    expect(views.getByRole("button", { name: /CVs ?1/ })).toBeInTheDocument()
    fireEvent.click(views.getByRole("button", { name: /Proofs ?0/ }))
    expect(screen.getByRole("link", { name: "Open Proofs" })).toHaveAttribute(
      "href",
      "/proofs"
    )
    fireEvent.click(views.getByRole("button", { name: /Files ?0/ }))
    expect(
      screen.getByRole("button", { name: "Import a file" })
    ).toBeInTheDocument()
    fireEvent.click(views.getByRole("button", { name: /All ?2/ }))
    expect(screen.getByRole("region", { name: "CVs" })).toBeInTheDocument()
  })

  it("continues the most recently edited page and preselects the template clicked in Start new", () => {
    renderLibrary([
      cv("An earlier CV"),
      {
        ...letter("Latest letter.docx"),
        updatedAt: "2027-01-02T12:00:00.000Z",
      },
    ])
    const hero = within(
      screen.getByRole("region", { name: "Continue editing" })
    )
    expect(
      hero.getByRole("heading", { name: "Latest letter" })
    ).toBeInTheDocument()
    expect(hero.getByRole("button", { name: "Open" })).toBeInTheDocument()
    expect(hero.getByText(/^Letter · Edited/)).toBeInTheDocument()
    fireEvent.click(
      within(screen.getByRole("region", { name: "Start new" })).getByRole(
        "button",
        { name: "Modern" }
      )
    )
    const chooser = within(screen.getByRole("dialog", { name: "New CV" }))
    expect(chooser.getByRole("radio", { name: "Modern" })).toHaveAttribute(
      "aria-checked",
      "true"
    )
    expect(
      chooser.getByRole("button", { name: "Use Modern" })
    ).toBeInTheDocument()
  })

  it("shows imported files without documents and keeps their delete action", async () => {
    renderLibrary(
      [],
      [
        {
          id: "33333333-3333-4333-8333-333333333333",
          name: "Original CV.pdf",
          mediaType: "application/pdf",
          byteSize: 42,
          createdAt: "2026-08-25T12:00:00.000Z",
        },
      ]
    )
    expect(screen.queryByText("Start a document")).not.toBeInTheDocument()
    const filesSection = screen.getByRole("region", { name: "Files" })
    expect(within(filesSection).getAllByText("Original CV")).not.toHaveLength(0)
    expect(within(filesSection).getByText("PDF")).toBeInTheDocument()
    expect(
      within(screen.getByRole("region", { name: "CVs" })).getAllByRole(
        "button",
        {
          name: "New CV",
        }
      )[0]!
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole("region", { name: "Letters" })).getAllByRole(
        "button",
        { name: "New letter" }
      )[0]!
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Open Proofs" })).toHaveAttribute(
      "href",
      "/proofs"
    )
    fireEvent.click(screen.getByRole("button", { name: "Original CV menu" }))
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Delete", exact: true })
    )
    expect(
      screen.getByRole("dialog", { name: 'Delete "Original CV"?' })
    ).toBeInTheDocument()
  })

  it("gives every card menu row an icon and puts Delete last, in red, after a separator", async () => {
    renderLibrary([cv("Linh CV")])
    fireEvent.click(screen.getByRole("button", { name: "Linh CV menu" }))
    const rows = await screen.findAllByRole("menuitem")
    for (const row of rows) expect(row.querySelector("svg")).not.toBeNull()
    const remove = rows.at(-1)!
    expect(remove).toHaveTextContent("Delete")
    expect(remove).toHaveAttribute("data-variant", "destructive")
    expect(screen.getAllByRole("separator")).toHaveLength(1)
    expect(
      screen.getByRole("menuitem", { name: "Link to application" })
    ).toHaveAttribute("data-variant", "default")
  })

  it("names the document in the delete confirm and makes Delete the red final action", async () => {
    renderLibrary([cv("Linh CV")])
    fireEvent.click(screen.getByRole("button", { name: "Linh CV menu" }))
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Delete", exact: true })
    )
    const dialog = screen.getByRole("dialog", { name: 'Delete "Linh CV"?' })
    expect(
      within(dialog).getByRole("button", { name: "Delete" })
    ).toHaveAttribute("data-variant", "destructive")
    expect(
      within(dialog).getByRole("button", { name: "Cancel" })
    ).toHaveAttribute("data-variant", "ghost")
  })

  it("names a CV card from the document and hides it when search misses", async () => {
    renderLibrary([cv("PM track CV")])
    expect(
      screen.getByRole("button", { name: /^PM track CV,/ })
    ).toBeInTheDocument()

    fireEvent.change(screen.getByRole("searchbox", { name: "Search Paper" }), {
      target: { value: "portfolio" },
    })

    expect(screen.getByText('No results for "portfolio"')).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /^PM track CV,/ })
    ).not.toBeInTheDocument()
    expect(
      screen.getByText("Try another word, or clear the search.")
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: "Open Proofs" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "New letter" })
    ).not.toBeInTheDocument()
  })

  it("keeps Letters and Proofs reachable, and shows the page's first lines", () => {
    renderLibrary([letter("Design letter")])
    expect(screen.getByRole("region", { name: "Letters" })).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Blank Letter" })
    ).toBeInTheDocument()
    const proofs = screen.getByRole("link", { name: "Open Proofs" })
    expect(proofs).toHaveAttribute("href", "/proofs")
    const lead = document.querySelector(
      "[data-slot=paper-library-preview-name]"
    )
    expect(lead).toHaveTextContent("A cover letter.")
    expect(lead).not.toHaveTextContent("Design letter")
    expect(
      document.querySelector("[data-slot=paper-library-preview]")
    ).toBeNull()
  })

  it("routes Word cards to the page preview even when no block body exists", () => {
    renderLibrary([
      { ...letter("Word letter.docx"), format: "word", paper: undefined },
    ])
    expect(
      screen.getByRole("button", { name: /^Word letter,/ })
    ).toBeInTheDocument()
    expect(
      document.querySelector("[data-slot=paper-word-preview]")
    ).toBeInTheDocument()
    expect(
      document.querySelector("[data-slot=paper-library-preview-name]")
    ).toBeNull()
  })

  it("follows Proofs inside the app and keeps a modified click on this page", async () => {
    const router = proofsRouter()
    render(
      <RouterContextProvider router={router}>
        <PaperLibrary
          docs={[cv("My CV")]}
          files={[]}
          loading={false}
          error={null}
          onRetry={() => undefined}
          onOpen={() => undefined}
          query=""
          onQueryChange={() => undefined}
        />
      </RouterContextProvider>
    )
    const proofs = screen.getByRole("link", { name: "Open Proofs" })
    fireEvent.click(proofs, { metaKey: true })
    expect(router.state.location.pathname).toBe("/")
    fireEvent.click(proofs)
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/proofs")
    })
  })
})
