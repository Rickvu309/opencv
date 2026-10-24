import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, screen, waitFor, within } from "@testing-library/react"

import { setMockSession } from "@/test/auth-client-mock.ts"
import { renderApp } from "@/test/render-app.tsx"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

async function renderLanding() {
  setMockSession(null)
  const view = renderApp("/")
  const headline = await screen.findByRole("heading", { level: 1 })
  return { ...view, headline }
}

describe("landing page", () => {
  it("keeps a signed-out visitor on / under the headline", async () => {
    const { router, headline } = await renderLanding()

    expect(headline).toHaveTextContent(
      "A first-job coach for Vietnamese students and new graduates."
    )
    expect(
      screen.getByText(
        "OpenCV is a coach with a CV editor, an application board and a public page for your work. You write the CV with the coach, then send each application and track every answer."
      )
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe("/")
  })

  it("sets the document title and description", async () => {
    await renderLanding()

    await waitFor(() => {
      expect(document.title).toBe(
        "OpenCV, a first-job coach for Vietnamese students and new graduates"
      )
    })
    expect(
      document.head.querySelector('meta[name="description"]')
    ).toHaveAttribute(
      "content",
      "OpenCV is a coach with a CV editor, an application board and a public page for your work. You write the CV with the coach, then send each application and track every answer."
    )
  })

  it("links Start with a coach to sign-up and Sign in to sign-in", async () => {
    await renderLanding()

    const startLinks = screen.getAllByRole("link", {
      name: "Start with a coach",
    })
    expect(startLinks).toHaveLength(3)
    for (const link of startLinks) {
      expect(link).toHaveAttribute("href", "/sign-up")
    }

    const signIn = screen.getAllByRole("link", { name: "Sign in" })
    expect(signIn.length).toBeGreaterThanOrEqual(2)
    for (const link of signIn) {
      expect(link).toHaveAttribute("href", "/sign-in")
    }
  })

  it("shows the four surfaces in order, each with one screenshot", async () => {
    await renderLanding()

    const titles = [
      "Coach. Find the role to apply for.",
      "Paper. Write the CV beside the coach.",
      "Apply. Track every application.",
      "Pitch. Share one page of your work.",
    ]
    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent)
    expect(headings).toEqual(titles)

    for (const title of titles) {
      const section = screen
        .getByRole("heading", {
          level: 2,
          name: (name) => name.replace(/\.\s*/, ". ") === title,
        })
        .closest("section")
      expect(section).not.toBeNull()
      expect(within(section!).getAllByRole("img")).toHaveLength(1)
    }

    const anchors = within(
      screen.getByRole("navigation", { name: "Surfaces" })
    ).getAllByRole("link")
    expect(anchors.map((a) => a.getAttribute("href"))).toEqual([
      "#coach",
      "#paper",
      "#apply",
      "#pitch",
    ])
  })

  it("answers the generic CV doubt before the first surface", async () => {
    await renderLanding()

    const objection = screen.getByText(
      "Answers come from your CV and goals, and you edit every line."
    )
    const coach = screen.getByRole("heading", { level: 2, name: /^Coach/ })
    expect(
      objection.compareDocumentPosition(coach) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it("keeps the closing line as plain text with one primary action", async () => {
    await renderLanding()

    const closing = screen.getByText(
      "Write the CV, send it, and keep every answer in one place. Free today."
    )
    expect(closing.tagName).toBe("P")
    expect(closing.children).toHaveLength(0)
    expect(
      screen.queryByText("Knows your story", { exact: false })
    ).not.toBeInTheDocument()
  })

  it("leaves out sections the product cannot back up", async () => {
    await renderLanding()

    expect(document.body).not.toHaveTextContent(
      /pricing|testimonial|changelog/i
    )
    expect(
      screen.queryByRole("combobox", { name: /language/i })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /language|english|tiếng việt/i })
    ).not.toBeInTheDocument()
  })

  it("describes every image and stays on the light theme", async () => {
    const { container } = await renderLanding()

    const images = screen.getAllByRole("img")
    expect(images.length).toBeGreaterThanOrEqual(5)
    for (const image of images) {
      expect(image.getAttribute("alt")?.trim()).toBeTruthy()
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
      screen.queryByRole("heading", {
        level: 1,
        name: "A first-job coach for Vietnamese students and new graduates.",
      })
    ).not.toBeInTheDocument()
  })
})
