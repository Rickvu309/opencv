import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { setMockSession } from "@/test/auth-client-mock.ts"
import { renderApp } from "@/test/render-app.tsx"

import {
  BLOG_DESCRIPTION,
  BLOG_POSTS,
  BLOG_TITLE,
  blogPostTitle,
  readLabel,
} from "./blog-copy.ts"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const FEATURED = BLOG_POSTS[0]
const REST = BLOG_POSTS.slice(1)

describe("blog index", () => {
  it("shows the newest post first and links every other post", async () => {
    setMockSession(null)
    renderApp("/blog")

    expect(
      await screen.findByRole("heading", { level: 1, name: "Blog" })
    ).toBeInTheDocument()
    expect(screen.getByText(BLOG_DESCRIPTION)).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { level: 2, name: FEATURED.title })
    ).toBeInTheDocument()
    expect(screen.getByText(FEATURED.dek)).toBeInTheDocument()
    expect(screen.getByText("The opencv team")).toBeInTheDocument()
    expect(screen.queryByText("Minh Tran")).not.toBeInTheDocument()
    expect(screen.queryByText(/one short note a week/i)).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /subscribe/i })
    ).not.toBeInTheDocument()

    const featured = screen.getByRole("link", {
      name: new RegExp(FEATURED.title),
    })
    expect(featured).toHaveAttribute("href", `/blog/${FEATURED.slug}`)
    expect(featured).toHaveTextContent(readLabel(FEATURED.body))

    for (const post of REST) {
      const link = screen.getByRole("link", { name: new RegExp(post.title) })
      expect(link).toHaveAttribute("href", `/blog/${post.slug}`)
      expect(link).toHaveTextContent(post.dek)
      expect(link).toHaveTextContent(readLabel(post.body))
    }

    await waitFor(() => {
      expect(document.title).toBe(BLOG_TITLE)
    })
    expect(
      document.head.querySelector('meta[name="description"]')
    ).toHaveAttribute("content", BLOG_DESCRIPTION)
  })

  it("opens a post from the index and returns through All posts", async () => {
    setMockSession(null)
    const { router } = renderApp("/blog")
    const user = userEvent.setup()
    const next = REST[0]
    if (!next) throw new Error("missing post")

    await user.click(
      await screen.findByRole("link", { name: new RegExp(next.title) })
    )
    expect(
      await screen.findByRole("heading", { level: 1, name: next.title })
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(`/blog/${next.slug}`)

    await user.click(screen.getByRole("link", { name: "All posts" }))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/blog")
    })
    expect(
      screen.getByRole("heading", { level: 1, name: "Blog" })
    ).toBeInTheDocument()
  })
})

describe("blog post", () => {
  it("shows the article, three other posts, and a way back", async () => {
    setMockSession(null)
    const { router } = renderApp("/blog/applying-is-b2b-sales")
    const user = userEvent.setup()

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Applying is B2B sales",
      })
    ).toBeInTheDocument()
    expect(screen.getByText(FEATURED.dek)).toBeInTheDocument()
    expect(screen.getByText("The opencv team")).toBeInTheDocument()
    expect(screen.getByText(readLabel(FEATURED.body))).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { level: 2, name: "Know the buyer" })
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "You're not asking to be picked. You're showing why you're the obvious choice."
      )
    ).toBeInTheDocument()
    expect(
      screen.getByRole("img", {
        name: /CV page, a chart, and an open briefcase/,
      })
    ).toBeInTheDocument()

    const more = screen.getByRole("heading", { level: 2, name: "Keep reading" })
    const region = more.closest("section")
    if (!region) throw new Error("missing keep reading")
    for (const title of [
      "Show your work, not your duties",
      "Stop mass applying",
      "Tailor the top third",
    ]) {
      expect(
        within(region).getByRole("link", { name: new RegExp(title) })
      ).toBeInTheDocument()
    }
    expect(
      within(region).getByRole("link", { name: "All posts" })
    ).toHaveAttribute("href", "/blog")
    expect(
      within(region).queryByRole("link", { name: /Applying is B2B sales/ })
    ).not.toBeInTheDocument()

    await waitFor(() => {
      expect(document.title).toBe(blogPostTitle(FEATURED.title))
    })

    const main = within(screen.getByRole("main"))
    await user.click(main.getByRole("link", { name: "Blog" }))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/blog")
    })
  })

  it("shows the existing not-found page for an unknown slug", async () => {
    setMockSession(null)
    renderApp("/blog/not-a-post")

    expect(
      await screen.findByRole("heading", { level: 1, name: "Page not found" })
    ).toBeInTheDocument()
    expect(screen.getByText("This page does not exist.")).toBeInTheDocument()
  })
})
