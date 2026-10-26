import {
  act,
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { renderApp } from "@/test/render-app.tsx"
import { mockJob } from "@/test/apply-job-fixtures.ts"
import { getMockJobPosts, setMockJobs } from "@/test/apply-jobs-mock.ts"

const junior = mockJob()
const applied = mockJob({
  id: "01900000-0000-7000-8000-000000000011",
  title: "Business Analyst",
  company: "Regional bank",
  stage: "applied",
  position: "a0",
})
const interview = mockJob({
  id: "01900000-0000-7000-8000-000000000012",
  title: "Associate PM intern",
  company: "Local startup",
  stage: "interview",
  position: "a0",
})

describe("apply board", () => {
  beforeEach(() => {
    setMockJobs([])
  })
  afterEach(() => {
    cleanup()
  })

  it("shows one empty action and hides Closed", async () => {
    renderApp("/app/apply")
    expect(
      await screen.findByRole("heading", { name: "Track your first job" })
    ).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: "Add job" })).toHaveLength(1)
    expect(
      screen.queryByRole("region", { name: "Closed" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Hidden columns" })
    ).not.toBeInTheDocument()
  })

  it("names the four lanes and opens a card", async () => {
    setMockJobs([junior, applied, interview])
    const { router } = renderApp("/app/apply")
    expect(
      await screen.findByRole("region", { name: "Saved" })
    ).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Applied" })).toBeInTheDocument()
    expect(
      screen.getByRole("region", { name: "Interview" })
    ).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Offer" })).toBeInTheDocument()
    expect(
      screen.queryByRole("region", { name: "Closed" })
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Hidden columns" }))
    expect(screen.getByRole("region", { name: "Closed" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "New job" })).toHaveAttribute(
      "data-variant",
      "glow"
    )
    fireEvent.click(
      screen.getByRole("button", {
        name: "Junior Marketing, Lumière Cosmetics",
      })
    )
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/app/apply/${junior.id}`)
    })
  })

  it("shows one clear-filters empty state", async () => {
    setMockJobs([junior])
    renderApp("/app/apply")
    await screen.findByRole("region", { name: "Saved" })
    fireEvent.click(screen.getByRole("button", { name: "Filter" }))
    fireEvent.change(await screen.findByLabelText("Company"), {
      target: { value: "Nope" },
    })
    expect(
      await screen.findByText("No jobs match these filters. Try removing one.")
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }))
    expect(
      await screen.findByRole("button", {
        name: "Junior Marketing, Lumière Cosmetics",
      })
    ).toBeInTheDocument()
  })

  it("keeps one glow while the new job dialog is open", async () => {
    renderApp("/app/apply")
    const add = await screen.findByRole("button", { name: "Add job" })
    expect(add).toHaveAttribute("data-variant", "glow")
    fireEvent.click(add)
    const dialog = await screen.findByRole("dialog", { name: "New job" })
    expect(add).toHaveAttribute("data-variant", "ghost")
    expect(
      within(dialog).getByRole("button", { name: "Add job" })
    ).toHaveAttribute("data-variant", "glow")
  })

  it("persists a keyboard move on drop", async () => {
    const rect = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        const board = this.closest("[data-slot='kanban-board']")
        const stage =
          board?.getAttribute("data-stage") ?? this.getAttribute("data-stage")
        const order = ["saved", "applied", "interview", "offer", "closed"]
        const index = stage ? order.indexOf(stage) : -1
        const card = this.closest("[data-slot='kanban-card']")
        if (index < 0) return new DOMRect(24, 96, 200, 80)
        return new DOMRect(
          index * 320 + (card ? 24 : 0),
          card ? 96 : 0,
          card ? 200 : 244,
          card ? 80 : 480
        )
      })
    try {
      setMockJobs([junior, applied])
      renderApp("/app/apply")
      const card = await screen.findByRole("button", {
        name: "Junior Marketing, Lumière Cosmetics",
      })
      async function key(target: EventTarget, code: string) {
        await act(async () => {
          fireEvent.keyDown(target, {
            code,
            key: code === "Space" ? " " : code,
          })
          await new Promise((resolve) => setTimeout(resolve, 0))
        })
      }
      card.focus()
      await key(card, "Space")
      await key(document, "ArrowRight")
      await key(document, "Escape")
      expect(getMockJobPosts().some((post) => post.name === "job.move")).toBe(
        false
      )
      await key(card, "Space")
      await key(document, "ArrowRight")
      await key(document, "Space")
      await waitFor(() => {
        expect(
          getMockJobPosts().some(
            (post) =>
              post.name === "job.move" &&
              post.input.jobId === junior.id &&
              post.input.stage === "applied"
          )
        ).toBe(true)
      })
    } finally {
      rect.mockRestore()
    }
  })
})
