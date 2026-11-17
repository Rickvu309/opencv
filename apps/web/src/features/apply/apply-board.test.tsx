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
    renderApp("/apply")
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
    const { router } = renderApp("/apply")
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
    fireEvent.click(screen.getByRole("button", { name: "Closed" }))
    expect(screen.getByRole("region", { name: "Closed" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "New job" })).toHaveAttribute(
      "data-variant",
      "ghost"
    )
    fireEvent.click(
      screen.getByRole("button", {
        name: "Junior Marketing, Lumière Cosmetics",
      })
    )
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/apply/${junior.id}`)
    })
  })

  it("shows one clear-filters empty state", async () => {
    setMockJobs([junior])
    renderApp("/apply")
    await screen.findByRole("region", { name: "Saved" })
    fireEvent.click(screen.getByRole("button", { name: "Filter" }))
    fireEvent.change(await screen.findByLabelText("Company"), {
      target: { value: "Nope" },
    })
    expect(
      await screen.findByRole("heading", {
        name: "No jobs match these filters",
      })
    ).toBeInTheDocument()
    expect(screen.getByText("Try removing one.")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Remove company filter" })
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }))
    expect(
      await screen.findByRole("button", {
        name: "Junior Marketing, Lumière Cosmetics",
      })
    ).toBeInTheDocument()
  })

  it("counts the hidden Closed column and shows its lane on demand", async () => {
    const closed = mockJob({
      id: "01900000-0000-7000-8000-000000000014",
      title: "Content intern",
      company: "Agency",
      stage: "closed",
      position: "a0",
    })
    setMockJobs([junior, closed])
    renderApp("/apply")
    const rail = await screen.findByRole("button", { name: "Closed" })
    expect(rail).toHaveTextContent("1")
    expect(rail).toHaveAttribute("aria-pressed", "false")
    expect(
      screen.queryByRole("button", { name: "Content intern, Agency" })
    ).not.toBeInTheDocument()
    fireEvent.click(rail)
    expect(rail).toHaveAttribute("aria-pressed", "true")
    expect(
      await screen.findByRole("button", { name: "Content intern, Agency" })
    ).toBeInTheDocument()
  })

  it("removes one filter from its chip", async () => {
    setMockJobs([junior, applied])
    renderApp("/apply")
    await screen.findByRole("region", { name: "Saved" })
    fireEvent.click(screen.getByRole("button", { name: "Filter" }))
    fireEvent.change(await screen.findByLabelText("Company"), {
      target: { value: "Regional" },
    })
    expect(
      screen.queryByRole("button", {
        name: "Junior Marketing, Lumière Cosmetics",
      })
    ).not.toBeInTheDocument()
    fireEvent.click(
      screen.getByRole("button", { name: "Remove company filter" })
    )
    expect(
      await screen.findByRole("button", {
        name: "Junior Marketing, Lumière Cosmetics",
      })
    ).toBeInTheDocument()
  })

  it("tags an interview inside the next seven days only", async () => {
    const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
    const later = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString()
    setMockJobs([
      { ...interview, interviewAt: soon },
      {
        ...interview,
        id: "01900000-0000-7000-8000-000000000015",
        title: "Data intern",
        interviewAt: later,
      },
    ])
    renderApp("/apply")
    await screen.findByRole("region", { name: "Interview" })
    expect(
      screen.getAllByText(/^Interview \w{3}, \d{1,2}:\d{2}$/)
    ).toHaveLength(1)
  })

  it("adds a job into the column whose plus was pressed", async () => {
    setMockJobs([junior, applied, interview])
    renderApp("/apply")
    fireEvent.click(
      await screen.findByRole("button", { name: "New job in Interview" })
    )
    await screen.findByRole("dialog", { name: "New job" })
    fireEvent.change(screen.getByLabelText("Role title"), {
      target: { value: "Data intern" },
    })
    fireEvent.change(screen.getByLabelText("Company"), {
      target: { value: "Harbor Labs" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Add job" }))
    await waitFor(() => {
      expect(
        getMockJobPosts().some(
          (post) =>
            post.name === "job.create" &&
            post.input.title === "Data intern" &&
            post.input.stage === "interview"
        )
      ).toBe(true)
    })
    expect(await screen.findByText("Job added to Interview")).toBeVisible()
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "New job" })
      ).not.toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole("button", { name: "New job" }))
    fireEvent.change(await screen.findByLabelText("Role title"), {
      target: { value: "Sales intern" },
    })
    fireEvent.change(screen.getByLabelText("Company"), {
      target: { value: "Harbor Labs" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Add job" }))
    await waitFor(() => {
      expect(
        getMockJobPosts().some(
          (post) =>
            post.name === "job.create" &&
            post.input.title === "Sales intern" &&
            post.input.stage === "saved"
        )
      ).toBe(true)
    })
  })

  it("opens the new job dialog on N and ignores typing", async () => {
    renderApp("/apply")
    await screen.findByRole("button", { name: "Add job" })
    fireEvent.keyDown(document.body, { key: "n" })
    expect(
      await screen.findByRole("dialog", { name: "New job" })
    ).toBeInTheDocument()
  })

  it("keeps one solid primary while the new job dialog is open", async () => {
    renderApp("/apply")
    const add = await screen.findByRole("button", { name: "Add job" })
    expect(add).toHaveAttribute("data-variant", "primary")
    fireEvent.click(add)
    const dialog = await screen.findByRole("dialog", { name: "New job" })
    expect(add).toHaveAttribute("data-variant", "ghost")
    expect(
      within(dialog).getByRole("button", { name: "Add job" })
    ).toHaveAttribute("data-variant", "primary")
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
      renderApp("/apply")
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

  it("moves into an empty column from the keyboard", async () => {
    const offer = mockJob({
      id: "01900000-0000-7000-8000-000000000013",
      title: "Support engineer",
      company: "Northwind Labs",
      stage: "offer",
      position: "a0",
    })
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
          card ? 80 : 2400
        )
      })
    try {
      setMockJobs([applied, offer])
      renderApp("/apply")
      const card = await screen.findByRole("button", {
        name: "Business Analyst, Regional bank",
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
      await key(document, "Space")
      await waitFor(() => {
        expect(
          getMockJobPosts().some(
            (post) =>
              post.name === "job.move" &&
              post.input.jobId === applied.id &&
              post.input.stage === "interview"
          )
        ).toBe(true)
      })
      expect(
        getMockJobPosts().some(
          (post) => post.name === "job.move" && post.input.stage === "offer"
        )
      ).toBe(false)
    } finally {
      rect.mockRestore()
    }
  })
  it("animates exactly the newly created card with motion-appear", async () => {
    setMockJobs([junior])
    renderApp("/apply")
    const initialCard = await screen.findByRole("button", {
      name: "Junior Marketing, Lumière Cosmetics",
    })
    const initialWrapper = initialCard.closest("[data-slot='kanban-card']")
    expect(initialWrapper).not.toHaveAttribute("data-new", "true")

    const dataNewValues: (string | null)[] = []
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "attributes" && m.attributeName === "data-new") {
          dataNewValues.push(m.oldValue)
        }
      }
    })
    observer.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ["data-new"],
      attributeOldValue: true,
    })

    fireEvent.click(screen.getByRole("button", { name: "New job" }))
    const dialog = await screen.findByRole("dialog", { name: "New job" })
    fireEvent.change(within(dialog).getByLabelText("Role title"), {
      target: { value: "Lead Designer" },
    })
    fireEvent.change(within(dialog).getByLabelText("Company"), {
      target: { value: "Acme Studio" },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Add job" }))

    const newCard = await screen.findByRole("button", {
      name: "Lead Designer, Acme Studio",
    })
    const newWrapper = newCard.closest("[data-slot='kanban-card']")
    expect(dataNewValues).toContain("true")
    expect(newWrapper?.className).toContain("data-[new=true]:motion-appear")
    expect(initialWrapper).not.toHaveAttribute("data-new", "true")
    expect(newWrapper).not.toHaveAttribute("data-new")
    observer.disconnect()
  })
})
