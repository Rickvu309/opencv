import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { renderApp } from "@/test/render-app.tsx"
import { mockJob } from "@/test/apply-job-fixtures.ts"
import { setMockJobs } from "@/test/apply-jobs-mock.ts"

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
    const glows = document.querySelectorAll("[data-variant='glow']")
    expect(glows).toHaveLength(1)
    expect(glows[0]).toHaveAccessibleName("New job")
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
})
