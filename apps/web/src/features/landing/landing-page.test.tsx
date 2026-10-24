import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, screen, waitFor } from "@testing-library/react"

import { setMockSession } from "@/test/auth-client-mock.ts"
import { renderApp } from "@/test/render-app.tsx"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const HEADLINE = "Get your butt in your dream seat."
const SUBHEAD = "Turn what you’ve done into proof. Turn proof into interviews."
const STATEMENT_REST =
  "OpenCV helps you say it properly: clear proof of your work, then a CV, letter and page for the role you want."
const TITLE = "OpenCV — Get your butt in your dream seat."

const SURFACES = [
  {
    title: "Capture your work",
    srcs: ["/landing/coach.webp", "/landing/coach-act.webp"],
  },
  { title: "Write with a coach", srcs: ["/landing/paper.webp"] },
  { title: "Plan your search", srcs: ["/landing/apply.webp"] },
  { title: "Share your work", srcs: ["/landing/pitch.webp"] },
] as const

function follows(earlier: Element, later: Element) {
  return (
    (earlier.compareDocumentPosition(later) &
      Node.DOCUMENT_POSITION_FOLLOWING) !==
    0
  )
}

function sectionOf(heading: HTMLElement) {
  const section = heading.closest("section")
  if (!(section instanceof HTMLElement)) {
    throw new Error("heading is outside a section")
  }
  return section
}

async function renderLanding() {
  setMockSession(null)
  const view = renderApp("/")
  const headline = await screen.findByRole("heading", { level: 1 })
  return { ...view, headline }
}

describe("landing page", () => {
  it("keeps a signed-out visitor on / under the new headline", async () => {
    const { router, headline } = await renderLanding()

    expect(headline).toHaveTextContent(HEADLINE)
    expect(headline.querySelectorAll("br")).toHaveLength(1)
    expect(screen.getByText(SUBHEAD)).toBeInTheDocument()
    expect(router.state.location.pathname).toBe("/")
  })

  it("sets the document title and description from the new copy", async () => {
    await renderLanding()

    await waitFor(() => {
      expect(document.title).toBe(TITLE)
    })
    expect(
      document.head.querySelector('meta[name="description"]')
    ).toHaveAttribute("content", `${SUBHEAD} ${STATEMENT_REST}`)
  })

  it("sends Get started to sign-up and Log in to sign-in", async () => {
    await renderLanding()

    const startLinks = screen.getAllByRole("link", { name: "Get started" })
    expect(startLinks).toHaveLength(2)
    for (const link of startLinks) {
      expect(link).toHaveAttribute("href", "/sign-up")
    }

    const logIn = screen.getAllByRole("link", { name: "Log in" })
    expect(logIn).toHaveLength(2)
    for (const link of logIn) {
      expect(link).toHaveAttribute("href", "/sign-in")
    }
  })

  it("anchors Product and the four surfaces on the page", async () => {
    await renderLanding()

    const anchors = screen
      .getByRole("navigation", { name: "Primary" })
      .querySelectorAll("a")
    expect(
      [...anchors].map((anchor) => [
        anchor.textContent,
        anchor.getAttribute("href"),
      ])
    ).toEqual([
      ["Product", "#product"],
      ["Coach", "#coach"],
      ["Paper", "#paper"],
      ["Apply", "#apply"],
      ["Pitch", "#pitch"],
    ])

    expect(document.getElementById("product")).toBeInstanceOf(HTMLElement)
    for (const id of ["coach", "paper", "apply", "pitch"]) {
      expect(document.getElementById(id)).toBeInstanceOf(HTMLElement)
    }
  })

  it("places the chair, the statement, the figures, then real screenshots", async () => {
    const { container } = await renderLanding()

    const chair = screen.getByRole("img", { name: /leather armchair/i })
    expect(chair).toHaveAttribute("src", "/landing/chair.webp")
    const statement = screen.getByText("You’ve done more than your CV says.")
    const figures = container.querySelector("[data-slot='landing-figures']")
    const capture = screen.getByRole("heading", {
      level: 2,
      name: "Capture your work",
    })
    if (!(figures instanceof HTMLElement)) {
      throw new Error("missing figures slot")
    }

    expect(follows(chair, statement)).toBe(true)
    expect(follows(statement, figures)).toBe(true)
    expect(follows(figures, capture)).toBe(true)

    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent)
    const indexes = SURFACES.map((surface) => headings.indexOf(surface.title))
    expect(indexes.every((index) => index >= 0)).toBe(true)
    expect([...indexes].sort((a, b) => a - b)).toEqual(indexes)

    for (const surface of SURFACES) {
      const section = sectionOf(
        screen.getByRole("heading", { level: 2, name: surface.title })
      )
      const sources = [...section.querySelectorAll("img")].map((image) =>
        image.getAttribute("src")
      )
      expect(sources).toEqual([...surface.srcs])
    }
  })

  it("keeps the close as plain text with one primary action", async () => {
    await renderLanding()

    const closing = screen.getByText(/Be the obvious hire\./)
    expect(closing.tagName).toBe("P")
    expect(closing.querySelector("br")).not.toBeNull()
    const region = closing.closest("section")
    if (!(region instanceof HTMLElement)) {
      throw new Error("close is outside a section")
    }
    expect(
      [...region.querySelectorAll("a")].map((link) => link.textContent)
    ).toEqual(["Get started"])
  })

  it("leaves out sections the product cannot back up", async () => {
    await renderLanding()

    expect(document.body).not.toHaveTextContent(
      /pricing|testimonial|changelog|voice notes|see a sample|linked sources/i
    )
    expect(
      screen.queryByRole("link", { name: /^blog$/i })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: /^help$/i })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: /pricing/i })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("combobox", { name: /language/i })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(
        "A first-job coach for Vietnamese students and new graduates."
      )
    ).not.toBeInTheDocument()
  })

  it("names every photo and every role=img graphic, and stays light", async () => {
    const { container } = await renderLanding()

    const graphics = container.querySelectorAll("img, [role='img']")
    expect(graphics.length).toBeGreaterThanOrEqual(6)
    for (const node of graphics) {
      if (node.getAttribute("aria-hidden") === "true") continue
      const name =
        node.getAttribute("alt") ?? node.getAttribute("aria-label") ?? ""
      expect(name.trim().length).toBeGreaterThan(0)
    }
    expect(container.querySelector(".dark")).toBeNull()
    expect(document.documentElement).not.toHaveClass("dark")
  })
})

describe("index route guard", () => {
  it("redirects a signed-in visitor from / to /app", async () => {
    const { router } = renderApp("/")

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/app")
    })
    expect(
      screen.queryByRole("heading", { level: 1, name: HEADLINE })
    ).not.toBeInTheDocument()
  })
})
