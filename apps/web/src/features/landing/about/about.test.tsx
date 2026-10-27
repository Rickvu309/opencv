import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, screen, waitFor, within } from "@testing-library/react"

import { setMockSession } from "@/test/auth-client-mock.ts"
import { renderApp } from "@/test/render-app.tsx"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const LEDE =
  "A career coach inside a working product, for students and new graduates in Vietnam."

async function renderAbout() {
  setMockSession(null)
  const view = renderApp("/about")
  const headline = await screen.findByRole("heading", {
    level: 1,
    name: "About opencv",
  })
  return { ...view, headline }
}

describe("about page", () => {
  it("keeps one headline and the lede for students in Vietnam", async () => {
    const { router, headline } = await renderAbout()

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(headline).toHaveTextContent("About opencv")
    expect(screen.getByText(LEDE)).toBeInTheDocument()
    expect(router.state.location.pathname).toBe("/about")
  })

  it("sets the document title and description", async () => {
    await renderAbout()

    await waitFor(() => {
      expect(document.title).toBe("opencv. About")
    })
    expect(
      document.head.querySelector('meta[name="description"]')
    ).toHaveAttribute("content", LEDE)
  })

  it("tells the story and the four beliefs", async () => {
    await renderAbout()

    expect(
      screen.getByRole("heading", { level: 2, name: "Why we built it" })
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "Most early-career CVs list duties. You have done more than that list shows."
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "Hiring is a sale to one buyer. You write a CV and a letter for that role."
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "opencv helps you show what you did, for each role. Show your work. Get the job."
      )
    ).toBeInTheDocument()

    expect(
      screen.getByRole("heading", { level: 2, name: "What we believe" })
    ).toBeInTheDocument()
    for (const title of [
      "Show the work",
      "One CV per job",
      "You stay in charge",
      "Your data is yours",
    ]) {
      expect(
        screen.getByRole("heading", { level: 3, name: title })
      ).toBeInTheDocument()
    }
    expect(
      screen.getByText(
        "Coach does the work while you watch, and nothing is sent without your click."
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText("Export your data, or delete the account, in Settings.")
    ).toBeInTheDocument()
  })

  it("names each principle figure", async () => {
    await renderAbout()

    for (const name of [
      "A CV page with uneven lines and a small proof block on the corner.",
      "One CV page beside a single job card.",
      "A screen of steps, a letter waiting on the desk, and a button that has not been pressed.",
      "A closed case with a handle, holding your papers.",
    ]) {
      expect(screen.getByRole("img", { name })).toBeInTheDocument()
    }
  })

  it("links Paper, Apply and Coach to the landing sections", async () => {
    await renderAbout()

    for (const [name, href] of [
      ["Paper", "/#paper"],
      ["Apply", "/#apply"],
      ["Coach", "/#coach"],
    ] as const) {
      const links = screen.getAllByRole("link", { name })
      expect(links.length).toBeGreaterThanOrEqual(2)
      for (const link of links) expect(link).toHaveAttribute("href", href)
    }
  })

  it("matches the coming-next line and reuses the close", async () => {
    await renderAbout()

    expect(
      screen.getByRole("heading", { level: 2, name: "What is next" })
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "Two new ways to show your work. Proof turns a CV line into evidence. Pitch is your CV and Proofs on one page."
      )
    ).toBeInTheDocument()

    for (const link of screen.getAllByRole("link", { name: "Get started" })) {
      expect(link).toHaveAttribute("href", "/sign-in")
    }
    expect(screen.getByRole("link", { name: "See a sample" })).toHaveAttribute(
      "href",
      "/#paper"
    )
  })

  it("lists About first in the company footer and not in the top nav", async () => {
    await renderAbout()

    const company = within(
      within(screen.getByRole("contentinfo")).getByRole("navigation", {
        name: "Company",
      })
    )
    const links = company.getAllByRole("link")
    expect(links.map((link) => link.textContent)).toEqual(["About", "Stories"])
    expect(links[0]).toHaveAttribute("href", "/about")

    expect(
      within(screen.getByRole("navigation", { name: "Primary" })).queryByRole(
        "link",
        { name: "About" }
      )
    ).not.toBeInTheDocument()
  })
})
