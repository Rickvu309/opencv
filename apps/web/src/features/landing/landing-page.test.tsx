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
  "opencv helps you say it properly: clear proof of your work, then a CV, letter and site written for each role you want."
const TITLE = "opencv. Get your butt in your dream seat."

const SECTION_IDS = [
  "hero",
  "logos",
  "product",
  "benefits",
  "capture",
  "plan",
  "assistant",
  "review",
  "stories",
  "close",
] as const

const FEATURES = [
  "Capture your work",
  "Plan your search",
  "Your writing assistant",
  "Review, then send",
] as const

async function renderLanding() {
  setMockSession(null)
  const view = renderApp("/")
  const headline = await screen.findByRole("heading", { level: 1 })
  return { ...view, headline }
}

describe("landing page", () => {
  it("keeps a signed-out visitor on / under the design headline", async () => {
    const { router, headline } = await renderLanding()

    expect(headline).toHaveTextContent(HEADLINE)
    expect(headline.querySelectorAll("br")).toHaveLength(1)
    expect(screen.getByText(SUBHEAD)).toBeInTheDocument()
    expect(router.state.location.pathname).toBe("/")
  })

  it("sets the document title and description from the design copy", async () => {
    await renderLanding()

    await waitFor(() => {
      expect(document.title).toBe(TITLE)
    })
    expect(
      document.head.querySelector('meta[name="description"]')
    ).toHaveAttribute("content", `${SUBHEAD} ${STATEMENT_REST}`)
  })

  it("sends Get started and Log in to sign-in, and Pricing to /pricing", async () => {
    await renderLanding()

    const startLinks = screen.getAllByRole("link", { name: "Get started" })
    expect(startLinks.length).toBeGreaterThanOrEqual(2)
    for (const link of startLinks) {
      expect(link).toHaveAttribute("href", "/sign-in")
    }

    for (const link of screen.getAllByRole("link", { name: "Log in" })) {
      expect(link).toHaveAttribute("href", "/sign-in")
    }

    const pricing = screen.getAllByRole("link", { name: "Pricing" })
    expect(pricing.length).toBeGreaterThan(0)
    for (const link of pricing) {
      expect(link).toHaveAttribute("href", "/pricing")
    }
  })

  it("renders the twelve sections in design order and keeps real destinations", async () => {
    const { container } = await renderLanding()

    const ids = [...container.querySelectorAll("main > section")].map(
      (section) => section.id
    )
    expect(ids).toEqual([...SECTION_IDS])

    for (const title of FEATURES) {
      expect(
        screen.getByRole("heading", { level: 2, name: title })
      ).toBeInTheDocument()
    }

    expect(
      screen.getByRole("heading", { name: "Proof, not claims" })
    ).toBeInTheDocument()
    const logos = container.querySelector("#logos")
    expect([...(logos?.children ?? [])].map((node) => node.tagName)).toEqual([
      "UL",
      "H2",
    ])
    expect(logos?.querySelector("h2")).toHaveTextContent(
      "PEOPLE USING OPENCV HAVE INTERVIEWED AT"
    )
    const stories = container.querySelector("#stories")
    const figures = stories?.querySelectorAll("figure")
    expect(figures).toHaveLength(2)
    expect(figures?.[0]?.querySelector(".landing-portrait")).toHaveTextContent(
      "MT"
    )
    expect(figures?.[0]).toHaveTextContent("Maya T.")
    expect(figures?.[1]).toHaveTextContent("Daniel K.")
    expect(
      stories?.querySelector(".landing-story-foot")?.lastElementChild
    ).toHaveAttribute("id", "stories-title")

    expect(
      screen.queryByRole("link", { name: /^blog$/i })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: /^help$/i })
    ).not.toBeInTheDocument()
    expect(container.querySelector('a[href*="/u/"]')).toBeNull()

    for (const image of container.querySelectorAll("img")) {
      expect(image.getAttribute("width")).toBeTruthy()
      expect(image.getAttribute("height")).toBeTruthy()
      expect(image.getAttribute("alt")?.trim().length).toBeGreaterThan(20)
    }
  })

  it("names every photo and stays on the light field", async () => {
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

describe("pricing page", () => {
  it("shows Free and Pro with sign-up actions", async () => {
    setMockSession(null)
    renderApp("/pricing")

    expect(
      await screen.findByRole("heading", { level: 1, name: "Pricing" })
    ).toBeInTheDocument()
    expect(screen.getByText("$0")).toBeInTheDocument()
    expect(screen.getByText("$9")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Start free" })).toHaveAttribute(
      "href",
      "/sign-in"
    )
    expect(screen.getByRole("link", { name: "Get Pro" })).toHaveAttribute(
      "href",
      "/sign-in"
    )
    expect(screen.getAllByText("Not included").length).toBeGreaterThan(0)
    expect(document.body).not.toHaveTextContent("–")
  })
})

describe("index route guard", () => {
  it("redirects a signed-in visitor from / to the start page", async () => {
    const { router } = renderApp("/")

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/app/apply")
    })
    expect(
      screen.queryByRole("heading", { level: 1, name: HEADLINE })
    ).not.toBeInTheDocument()
  })
})
