import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, screen, waitFor, within } from "@testing-library/react"

import { setMockSession } from "@/test/auth-client-mock.ts"
import { renderApp } from "@/test/render-app.tsx"

import "@/test/warm-routes.ts"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const HEADLINE = "Get your butt in your dream seat."
const SUBHEAD =
  "Tailor your CV for every job and track every application. Prep with Coach."
const STATEMENT_REST =
  "opencv helps you show it: a CV and letter written for each role, a board for every application, and a coach that knows both."
const TITLE = "opencv. Get your butt in your dream seat."

const SECTION_IDS = [
  "hero",
  "logos",
  "product",
  "benefits",
  "paper",
  "apply",
  "coach",
  "integrations",
  "coming-next",
  "stories",
  "close",
] as const

const SECTION_HEADINGS = [
  "Paper",
  "Apply",
  "Coach",
  "Works with your apps",
  "Coming next",
  "A CV for every job",
  "Every application in one place",
  "A coach that does the work",
] as const

const INTEGRATIONS = [
  "Gmail",
  "Google Calendar",
  "Zoom",
  "Google Meet",
  "Microsoft Teams",
  "Google Drive",
  "Microsoft OneDrive",
  "Notion",
  "Figma",
  "Canva",
  "LinkedIn",
  "GitHub",
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
    expect(document.querySelector(".landing-subhead")).toHaveTextContent(
      SUBHEAD
    )
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

    expect(screen.getByRole("link", { name: "Help" })).toHaveAttribute(
      "href",
      "/help"
    )
  })

  it("renders the sections in design order under their headings", async () => {
    const { container } = await renderLanding()

    const ids = [...container.querySelectorAll("main > section")].map(
      (section) => section.id
    )
    expect(ids).toEqual([...SECTION_IDS])

    for (const title of SECTION_HEADINGS) {
      expect(
        screen.getByRole("heading", { level: 2, name: title })
      ).toBeInTheDocument()
    }
    expect(
      screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)
    ).toEqual(["Proof", "Pitch"])
  })

  it("shows four features under each product", async () => {
    const { container } = await renderLanding()

    for (const [id, items] of [
      [
        "paper",
        ["Tailored CVs", "Import a CV", "Cover letters", "One-page check"],
      ],
      [
        "apply",
        ["Board and list", "Job details", "Calendar", "Interview prep"],
      ],
      [
        "coach",
        ["Tailor a CV", "Prep an interview", "Write a letter", "Email updates"],
      ],
    ] as const) {
      const listed = [
        ...(container.querySelectorAll(`#${id} .landing-features li`) ?? []),
      ].map((li) => li.textContent)
      expect(listed).toEqual([...items])
    }
  })

  it("sends every section link to a target that exists", async () => {
    const { container } = await renderLanding()

    const learnMore = screen.getAllByRole("link", { name: "Learn more" })
    expect(learnMore).toHaveLength(3)
    for (const link of learnMore)
      expect(link).toHaveAttribute("href", "/sign-in")

    expect(
      screen.getByRole("link", { name: "See all integrations" })
    ).toHaveAttribute("href", "/pricing")
    expect(
      screen.getByRole("link", { name: "Join the waitlist" })
    ).toHaveAttribute("href", "/sign-in")
    expect(screen.getByRole("link", { name: "See a sample" })).toHaveAttribute(
      "href",
      "/#paper"
    )

    const footer = within(screen.getByRole("contentinfo"))
    expect(footer.getByRole("link", { name: "Paper" })).toHaveAttribute(
      "href",
      "/#paper"
    )
    expect(footer.getByRole("link", { name: "Apply" })).toHaveAttribute(
      "href",
      "/#apply"
    )
    expect(footer.getByRole("link", { name: "Coach" })).toHaveAttribute(
      "href",
      "/#coach"
    )
    const company = within(footer.getByRole("navigation", { name: "Company" }))
    const companyLinks = company.getAllByRole("link")
    expect(companyLinks.map((link) => link.textContent)).toEqual([
      "About",
      "Stories",
      "Blog",
    ])
    expect(companyLinks[0]).toHaveAttribute("href", "/about")
    expect(companyLinks[1]).toHaveAttribute("href", "/stories")
    expect(companyLinks[2]).toHaveAttribute("href", "/blog")
    expect(
      within(screen.getByRole("navigation", { name: "Primary" })).queryByRole(
        "link",
        { name: "About" }
      )
    ).not.toBeInTheDocument()
    expect(footer.getByText("© 2026 opencv")).toBeInTheDocument()

    for (const link of screen.getAllByRole("link", { name: "Blog" })) {
      expect(link).toHaveAttribute("href", "/blog")
    }

    for (const gone of [
      /^examples$/i,
      /^careers$/i,
      /^privacy$/i,
      /^terms$/i,
    ]) {
      expect(screen.queryByRole("link", { name: gone })).not.toBeInTheDocument()
    }

    expect(
      screen.getByRole("link", { name: /read all stories/i })
    ).toHaveAttribute("href", "/stories")
    expect(container.querySelector('a[href*="/u/"]')).toBeNull()
  })

  it("lists the twelve apps Coach works with and the two customer stories", async () => {
    const { container } = await renderLanding()

    for (const name of INTEGRATIONS) {
      expect(screen.getByRole("img", { name })).toBeInTheDocument()
    }

    const stories = container.querySelector("#stories")
    const figures = stories?.querySelectorAll("figure")
    expect(figures).toHaveLength(2)
    expect(figures?.[0]).toHaveTextContent("Nguyễn Thảo Vy")
    expect(figures?.[0]).toHaveTextContent(
      "Brand Marketing Associate, Ho Chi Minh City"
    )
    expect(figures?.[1]).toHaveTextContent("Kim Ji-woo")
    expect(figures?.[1]).toHaveTextContent("UX Designer, Seoul")
    expect(stories).toHaveTextContent(
      "opencv helps people go from a first note to an offer."
    )

    const logos = container.querySelector("#logos")
    expect(logos?.querySelector("h2")).toHaveTextContent(
      "PEOPLE USING OPENCV HAVE INTERVIEWED AT"
    )

    for (const image of container.querySelectorAll("img")) {
      expect(image.getAttribute("width")).toBeTruthy()
      expect(image.getAttribute("height")).toBeTruthy()
      expect(image.getAttribute("alt")?.trim().length).toBeGreaterThan(0)
    }
  })

  it("names every photo and stays on the light field", async () => {
    const { container } = await renderLanding()

    const graphics = container.querySelectorAll("img, [role='img']")
    expect(graphics.length).toBeGreaterThanOrEqual(20)
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
    expect(
      screen.getAllByRole("img", { name: "Not included" }).length
    ).toBeGreaterThan(0)
    expect(screen.queryByText("Not included")).not.toBeInTheDocument()
    expect(document.body).toHaveTextContent("\u2013")
  })
})

describe("index route guard", () => {
  it("redirects a signed-in visitor from / to the start page", async () => {
    const { router } = renderApp("/")

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/apply")
    })
    expect(
      screen.queryByRole("heading", { level: 1, name: HEADLINE })
    ).not.toBeInTheDocument()
  })
})
