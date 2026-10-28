import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { setMockSession } from "@/test/auth-client-mock.ts"
import { renderApp } from "@/test/render-app.tsx"

import snapshot from "./design/stories.snapshot.json"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

async function renderStories() {
  setMockSession(null)
  const view = renderApp("/stories")
  const heading = await screen.findByRole("heading", {
    level: 1,
    name: snapshot.title,
  })
  return { ...view, heading }
}

describe("stories page", () => {
  it("renders the page heading and description from the snapshot", async () => {
    const { router, heading } = await renderStories()

    expect(heading).toBeInTheDocument()
    expect(screen.getByText(snapshot.description)).toBeInTheDocument()
    expect(router.state.location.pathname).toBe("/stories")
  })

  it("sets the document title and description", async () => {
    await renderStories()

    await waitFor(() => {
      expect(document.title).toBe("opencv. Stories")
    })
    expect(
      document.head.querySelector('meta[name="description"]')
    ).toHaveAttribute("content", snapshot.description)
  })

  it("shows the featured story with name, role and quote", async () => {
    const { container } = await renderStories()

    const featured = snapshot.featured
    expect(screen.getByText(featured.name)).toBeInTheDocument()
    expect(screen.getByText(featured.role)).toBeInTheDocument()
    expect(screen.getByText(featured.quote)).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: featured.readLabel })
    ).toBeInTheDocument()

    const photo = screen.getByRole("img", { name: featured.photo.alt })
    expect(photo).toBeInTheDocument()
    expect(photo).toHaveAttribute("width")
    expect(photo).toHaveAttribute("height")

    const heading = screen.getByRole("heading", {
      level: 2,
      name: "More stories",
    })
    expect(heading).toBeInTheDocument()

    for (const story of snapshot.stories) {
      expect(screen.getByText(story.quote)).toBeInTheDocument()
      expect(
        screen.getByRole("img", { name: story.photo.alt })
      ).toBeInTheDocument()
    }

    for (const image of container.querySelectorAll("img")) {
      expect(image.getAttribute("alt")?.trim().length).toBeGreaterThan(0)
      expect(image.getAttribute("width")).toBeTruthy()
      expect(image.getAttribute("height")).toBeTruthy()
    }
  })

  it("opens a dialog with quote and stats when Read her story is clicked", async () => {
    await renderStories()
    const user = userEvent.setup()

    const trigger = screen.getByRole("button", {
      name: snapshot.featured.readLabel,
    })
    await user.click(trigger)

    const dialog = await screen.findByRole("dialog")
    expect(dialog).toBeInTheDocument()
    expect(
      within(dialog).getByText(snapshot.featured.quote)
    ).toBeInTheDocument()
    expect(
      within(dialog).getAllByText(snapshot.featured.name).length
    ).toBeGreaterThan(0)
    expect(
      within(dialog).getAllByText(snapshot.featured.role).length
    ).toBeGreaterThan(0)
    for (const stat of snapshot.featured.stats) {
      expect(within(dialog).getByText(stat.value)).toBeInTheDocument()
      expect(within(dialog).getByText(stat.label)).toBeInTheDocument()
    }

    await user.click(within(dialog).getByRole("button", { name: "Close" }))
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
  })

  it("opens a dialog for a grid story card when clicked", async () => {
    await renderStories()
    const user = userEvent.setup()

    const firstStory = snapshot.stories[0]
    if (!firstStory) throw new Error("missing story")

    const card = screen.getByRole("button", {
      name: `Read story: ${firstStory.name}`,
    })
    await user.click(card)

    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText(firstStory.quote)).toBeInTheDocument()
    expect(within(dialog).getAllByText(firstStory.name).length).toBeGreaterThan(
      0
    )
    expect(within(dialog).getByText(firstStory.role)).toBeInTheDocument()
  })

  it("links Stories in the top nav to /stories and shows the close section", async () => {
    await renderStories()

    const nav = screen.getByRole("navigation", { name: "Primary" })
    expect(within(nav).getByRole("link", { name: "Stories" })).toHaveAttribute(
      "href",
      "/stories"
    )

    expect(
      screen.getAllByRole("link", { name: "Get started" }).length
    ).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole("link", { name: "See a sample" })).toHaveAttribute(
      "href",
      "/#paper"
    )
  })

  it("shows Stories in the footer company nav linking to /stories", async () => {
    await renderStories()

    const footer = screen.getByRole("contentinfo")
    const company = within(footer).getByRole("navigation", { name: "Company" })
    const storiesLink = within(company).getByRole("link", { name: "Stories" })
    expect(storiesLink).toHaveAttribute("href", "/stories")
  })
})
