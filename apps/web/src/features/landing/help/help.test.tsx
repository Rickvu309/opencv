import { afterEach, describe, expect, it } from "vitest"
import { cleanup, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { setMockSession } from "@/test/auth-client-mock.ts"
import { renderApp } from "@/test/render-app.tsx"

import { HELP_TOPICS, filterHelpTopics } from "./help-copy.ts"

afterEach(() => {
  cleanup()
})

describe("filterHelpTopics", () => {
  it("returns the same table when the query is blank", () => {
    expect(filterHelpTopics(HELP_TOPICS, "   ")).toEqual(HELP_TOPICS)
  })

  it("matches a topic title without dropping its questions", () => {
    const paper = HELP_TOPICS.find((topic) => topic.id === "paper")
    const matched = filterHelpTopics(HELP_TOPICS, "PAPER")
    expect(
      matched.find((topic) => topic.id === "paper")?.questions
    ).toHaveLength(paper?.questions.length ?? 0)
    expect(matched.map((topic) => String(topic.id))).not.toContain("inbox")
  })

  it("keeps only the questions that match", () => {
    const matched = filterHelpTopics(HELP_TOPICS, "hidden")
    expect(matched.map((topic) => topic.id)).toEqual(["apply"])
    expect(matched[0]?.questions).toHaveLength(1)
    expect(matched[0]?.questions[0]?.answer).toMatch(/hidden/i)
  })

  it("returns nothing when nothing matches", () => {
    expect(filterHelpTopics(HELP_TOPICS, "zzzz-no-match")).toEqual([])
  })

  it("gives every topic three to six questions and no long dashes", () => {
    const ids = new Set<string>()
    const text = HELP_TOPICS.flatMap((topic) => [
      topic.title,
      topic.blurb,
      ...topic.questions.flatMap((item) => [item.question, item.answer]),
    ]).join("\n")
    expect(text).not.toMatch(/[\u2014–!]/)
    for (const topic of HELP_TOPICS) {
      expect(topic.questions.length).toBeGreaterThanOrEqual(3)
      expect(topic.questions.length).toBeLessThanOrEqual(6)
      for (const item of topic.questions) {
        expect(ids.has(item.id)).toBe(false)
        ids.add(item.id)
      }
    }
  })
})

describe("help page", () => {
  it("shows the topics, the sign-in link and the document title", async () => {
    setMockSession(null)
    renderApp("/help")

    expect(
      await screen.findByRole("heading", { level: 1, name: "Help" })
    ).toBeInTheDocument()
    expect(
      screen.getByText("Answers to common questions about opencv.")
    ).toBeInTheDocument()

    const topics = within(
      screen.getByRole("navigation", { name: "Help topics" })
    )
    expect(topics.getByRole("link", { name: "Paper" })).toHaveAttribute(
      "href",
      "/help#paper"
    )
    expect(topics.getByRole("link", { name: "Apply" })).toHaveAttribute(
      "href",
      "/help#apply"
    )
    expect(
      topics.queryByRole("link", { name: "Inbox" })
    ).not.toBeInTheDocument()

    expect(screen.getByText("How do I sign in?")).toBeVisible()
    expect(screen.getByText(/There is no password\./)).toBeInTheDocument()
    expect(screen.getByText(/Light and Max need Pro/)).toBeInTheDocument()
    expect(screen.queryByText(/Inbox/)).not.toBeInTheDocument()
    expect(screen.getByText(/The Jobs page is coming soon/)).toBeInTheDocument()
    expect(screen.getByText(/Proof is coming soon\./)).toBeInTheDocument()
    expect(
      screen.getByText("Free is $0 a month. Pro is $9 a month.")
    ).toBeInTheDocument()

    await userEvent.click(screen.getByText("How do I sign in?"))
    expect(screen.getByText(/There is no password\./)).toBeVisible()

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/sign-in"
    )
    expect(screen.getByRole("link", { name: "Help" })).toHaveAttribute(
      "href",
      "/help"
    )
    expect(screen.queryByRole("link", { name: /@/ })).not.toBeInTheDocument()

    await waitFor(() => {
      expect(document.title).toBe("opencv. Help")
    })
    expect(
      document.head.querySelector('meta[name="description"]')
    ).toHaveAttribute(
      "content",
      "Answers to common questions about opencv. Sign in with an email code, then use Paper, Apply and Coach."
    )
  })

  it("filters questions as you type and shows an empty state", async () => {
    setMockSession(null)
    renderApp("/help")
    const user = userEvent.setup()
    const search = await screen.findByRole("searchbox", { name: "Search help" })

    await user.type(search, "inbox")
    expect(screen.getByRole("status")).toHaveTextContent("No answers match")
    expect(
      screen.queryByRole("heading", { level: 2, name: "Inbox" })
    ).not.toBeInTheDocument()

    await user.clear(search)
    await user.type(search, "board")
    expect(
      screen.getByRole("heading", { level: 2, name: "Apply" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { level: 2, name: "Paper" })
    ).not.toBeInTheDocument()
    expect(
      within(
        screen.getByRole("navigation", { name: "Help topics" })
      ).queryByRole("link", { name: "Paper" })
    ).not.toBeInTheDocument()

    await user.clear(search)
    await user.type(search, "zzzz-no-match")
    expect(screen.getByRole("status")).toHaveTextContent("No answers match")
    expect(
      screen.queryByRole("heading", { level: 2, name: "Apply" })
    ).not.toBeInTheDocument()
    expect(screen.queryByRole("navigation", { name: "Help topics" })).toBeNull()
    expect(
      screen.getByRole("heading", { level: 2, name: "Still stuck?" })
    ).toBeInTheDocument()
  })
})
