import { afterEach, describe, expect, it, vi } from "vitest"
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
import { parseFileId, parsePaperId } from "@workspace/domain/kernel"

import { render } from "@/test/render-with-client.tsx"
import { PaperLibrary } from "./paper-library.tsx"
import {
  cv,
  letter,
  libraryRouter,
  renderLibrary,
} from "./paper-library.fixtures.tsx"

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

function dated(name: string, n: number) {
  const stamp = `2026-01-${String(n + 1).padStart(2, "0")}T00:00:00.000Z`
  return {
    ...cv(name),
    id: parsePaperId(
      `11111111-1111-4111-8111-${n.toString(16).padStart(12, "0")}`
    ),
    createdAt: stamp,
    updatedAt: stamp,
  }
}

async function pickView(name: string) {
  fireEvent.click(screen.getByRole("button", { name: /^Show / }))
  fireEvent.click(
    await screen.findByRole("menuitemradio", { name: new RegExp(`^${name}`) })
  )
  await waitFor(() =>
    expect(screen.queryByRole("menu")).not.toBeInTheDocument()
  )
}

afterEach(() => {
  cleanup()
})

describe("Paper home sections", () => {
  it("filters the hand from the view menu and the search field", async () => {
    renderLibrary([cv("My CV"), letter("Design letter")])
    expect(
      screen.queryByRole("region", { name: "CVs" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("region", { name: "Letters" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("region", { name: "Files" })
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Show All" }))
    expect(
      await screen.findByRole("menuitemradio", { name: /^All/ })
    ).toHaveAttribute("aria-checked", "true")
    for (const name of [/^CVs/, /^Letters/, /^Proofs/, /^Files/])
      expect(screen.getByRole("menuitemradio", { name })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("menuitemradio", { name: /^All/ }))
    expect(
      screen.getByRole("button", { name: /^Open My CV,/ })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /^Open Design letter,/ })
    ).toBeInTheDocument()
    const search = screen.getByRole("searchbox", { name: "Search Paper" })
    expect(search).toHaveAttribute("placeholder", "Type to find a document")
    fireEvent.change(search, { target: { value: "design" } })
    expect(
      screen.queryByRole("button", { name: /^Open My CV,/ })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /^Open Design letter,/ })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: "Open Proofs" })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "New Letter" })
    ).toBeInTheDocument()
    fireEvent.change(search, { target: { value: "nothing" } })
    expect(
      screen.getByText("No documents match \u201cnothing\u201d")
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /^Open Design letter,/ })
    ).not.toBeInTheDocument()
    fireEvent.keyDown(search, { key: "Escape" })
    expect(search).toHaveValue("")
    expect(search).not.toHaveFocus()
    expect(
      screen.getByRole("button", { name: /^Open My CV,/ })
    ).toBeInTheDocument()
    fireEvent.change(search, { target: { value: "nothing" } })
    const clears = screen.getAllByRole("button", { name: "Clear search" })
    expect(clears).toHaveLength(2)
    fireEvent.click(clears[1]!)
    expect(search).toHaveValue("")
    expect(
      screen.getByRole("button", { name: /^Open My CV,/ })
    ).toBeInTheDocument()
  })

  it("keeps the header to the title, the view menu with search, and New", () => {
    renderLibrary([cv("My CV")])
    expect(screen.getByRole("heading", { name: "Paper" })).toHaveTextContent(
      /^Paper$/
    )
    expect(screen.getByRole("button", { name: "Show All" })).toHaveAttribute(
      "aria-haspopup",
      "menu"
    )
    expect(
      screen.getByRole("searchbox", { name: "Search Paper" })
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "New" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Import" }))
    expect(screen.getByRole("dialog", { name: "Import" })).toBeInTheDocument()
  })

  it("filters the library from the view menu and counts each view", async () => {
    renderLibrary([cv("My CV"), letter("Design letter")])
    fireEvent.click(screen.getByRole("button", { name: "Show All" }))
    expect(
      await screen.findByRole("menuitemradio", { name: /^CVs\s*1$/ })
    ).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole("menuitemradio", { name: /^Letters\s*1$/ })
    )
    expect(
      screen.getByRole("button", { name: "Show Letters" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /^Open My CV,/ })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /^Open Design letter,/ })
    ).toBeInTheDocument()
    await pickView("Proofs")
    expect(screen.getByRole("link", { name: "Open Proofs" })).toHaveAttribute(
      "href",
      "/proofs"
    )
    expect(screen.getByText("Proofs have their own page")).toBeInTheDocument()
    await pickView("Files")
    expect(screen.getByText("No files yet")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Import a file" }))
    expect(screen.getByRole("dialog", { name: "Import" })).toBeInTheDocument()
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    })
    await pickView("All")
    expect(
      screen.getByRole("button", { name: /^Open My CV,/ })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: "Open Proofs" })
    ).not.toBeInTheDocument()
  })

  it("centres the newest document and opens the CV picker from New CV", () => {
    renderLibrary([
      cv("An earlier CV"),
      {
        ...letter("Latest letter"),
        updatedAt: "2027-01-02T12:00:00.000Z",
      },
    ])
    const latest = screen.getByRole("button", { name: /^Open Latest letter,/ })
    expect(latest).toHaveAttribute("tabindex", "0")
    expect(screen.queryByRole("slider")).not.toBeInTheDocument()
    expect(screen.getByText("Latest letter")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Ask Coach" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("region", { name: "Continue editing" })
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "New CV" }))
    expect(screen.getByRole("dialog", { name: "New CV" })).toBeInTheDocument()
  })

  it("opens the centred page and rolls a side card in first", () => {
    const onOpen = vi.fn()
    render(
      libraryRouter(
        <PaperLibrary
          docs={[
            cv("My CV"),
            {
              ...letter("Design letter"),
              updatedAt: "2027-01-02T12:00:00.000Z",
            },
          ]}
          files={[]}
          loading={false}
          error={null}
          onRetry={() => undefined}
          onOpen={onOpen}
          query=""
          onQueryChange={() => undefined}
        />
      )
    )
    const side = screen.getByRole("button", { name: /^Open My CV,/ })
    fireEvent.click(side)
    expect(onOpen).not.toHaveBeenCalled()
    expect(
      screen.getByRole("button", { name: /^Open My CV,/ })
    ).toHaveAttribute("tabindex", "0")
    fireEvent.click(screen.getByRole("button", { name: /^Open My CV,/ }))
    expect(onOpen).toHaveBeenCalledWith(cv("My CV").id)
  })

  it("starts a long hand on the newest card and rolls with the arrow keys", () => {
    renderLibrary(Array.from({ length: 8 }, (_, n) => dated(`Doc ${n + 1}`, n)))
    const ruler = screen.getByRole("slider", {
      name: "Move through your documents",
    })
    expect(ruler).toHaveAttribute("aria-valuenow", "1")
    expect(ruler).toHaveAttribute("aria-valuemax", "8")
    expect(
      screen.getByRole("button", { name: /^Open Doc 8,/ })
    ).toHaveAttribute("tabindex", "0")
    expect(screen.getByRole("button", { name: "Doc 8 menu" })).toBeVisible()
    fireEvent.keyDown(screen.getByRole("group", { name: "Your documents" }), {
      key: "ArrowRight",
    })
    expect(ruler).toHaveAttribute("aria-valuenow", "2")
    expect(
      screen.getByRole("button", { name: /^Open Doc 7,/ })
    ).toHaveAttribute("tabindex", "0")
    expect(screen.getByRole("button", { name: /^Open Doc 7,/ })).toHaveFocus()
  })

  it("focuses search from slash and from a printable key", () => {
    renderLibrary([cv("My CV")])
    const search = screen.getByRole("searchbox", { name: "Search Paper" })
    search.blur()
    fireEvent.keyDown(document, { key: "/" })
    expect(search).toHaveFocus()
    search.blur()
    fireEvent.keyDown(document, { key: "q" })
    expect(search).toHaveFocus()
  })

  it("shows imported files in the hand and keeps their delete action", async () => {
    renderLibrary(
      [],
      [
        {
          id: parseFileId("33333333-3333-4333-8333-333333333333"),
          name: "Original CV.pdf",
          mediaType: "application/pdf",
          byteSize: 42,
          createdAt: "2026-08-25T12:00:00.000Z",
        },
      ]
    )
    expect(screen.queryByText("Start a document")).not.toBeInTheDocument()
    expect(screen.getAllByText("Original CV.pdf").length).toBeGreaterThan(0)
    expect(screen.getByText("PDF")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "New CV" })).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "New Letter" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: "Open Proofs" })
    ).not.toBeInTheDocument()
    await pickView("Proofs")
    expect(screen.getByRole("link", { name: "Open Proofs" })).toHaveAttribute(
      "href",
      "/proofs"
    )
    await pickView("All")
    fireEvent.click(
      screen.getByRole("button", { name: "Original CV.pdf menu" })
    )
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }))
    expect(
      screen.getByRole("dialog", { name: 'Delete "Original CV.pdf"?' })
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
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }))
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
      screen.getByRole("button", { name: /^Open PM track CV,/ })
    ).toBeInTheDocument()

    fireEvent.change(screen.getByRole("searchbox", { name: "Search Paper" }), {
      target: { value: "portfolio" },
    })

    expect(
      screen.getByText("No documents match \u201cportfolio\u201d")
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /^Open PM track CV,/ })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: "Open Proofs" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "New CV" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "New Letter" })
    ).not.toBeInTheDocument()
  })

  it("keeps Letters and Proofs reachable, and shows the page's first lines", async () => {
    renderLibrary([letter("Design letter")])
    expect(
      screen.queryByRole("button", { name: "Blank Letter" })
    ).not.toBeInTheDocument()
    const lead = document.querySelector(
      "[data-slot=paper-library-preview-name]"
    )
    expect(lead).toHaveTextContent("A cover letter.")
    expect(lead).not.toHaveTextContent("Design letter")
    expect(
      document.querySelector("[data-slot=paper-library-preview]")
    ).toBeNull()
    await pickView("Proofs")
    const proofs = screen.getByRole("link", { name: "Open Proofs" })
    expect(proofs).toHaveAttribute("href", "/proofs")
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
    await pickView("Proofs")
    const proofs = screen.getByRole("link", { name: "Open Proofs" })
    fireEvent.click(proofs, { metaKey: true })
    expect(router.state.location.pathname).toBe("/")
    fireEvent.click(proofs)
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/proofs")
    })
  })
})
