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
      "The career coach that gets you your first job."
    )
    expect(
      screen.getByText(
        "Chat with a coach, write your CV and letters, track every application, and share a portfolio page."
      )
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe("/")
  })

  it("links Start free to sign-up and Sign in to sign-in", async () => {
    await renderLanding()

    const startFree = screen.getAllByRole("link", { name: "Start free" })
    expect(startFree).toHaveLength(3)
    for (const link of startFree) {
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

    const titles = ["Coach", "Paper", "Apply", "Pitch"]
    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent)
    expect(headings).toEqual(titles)

    for (const title of titles) {
      const section = screen
        .getByRole("heading", { level: 2, name: title })
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
        name: "The career coach that gets you your first job.",
      })
    ).not.toBeInTheDocument()
  })
})
