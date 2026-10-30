import { cleanup, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it } from "vitest"

import { renderApp } from "@/test/render-app.tsx"
import { mockJob } from "@/test/apply-job-fixtures.ts"
import { setMockJobs } from "@/test/apply-jobs-mock.ts"

describe("apply list", () => {
  afterEach(() => {
    cleanup()
  })
  it("phrases saved, deadline, and applied jobs", async () => {
    setMockJobs([
      mockJob({
        id: "01900000-0000-7000-8000-000000000021",
        title: "Saved role",
        stage: "saved",
        createdAt: new Date().toISOString(),
        deadline: null,
      }),
      mockJob({
        id: "01900000-0000-7000-8000-000000000022",
        title: "Deadline role",
        stage: "saved",
        deadline: "2026-11-08",
        position: "a1",
      }),
      mockJob({
        id: "01900000-0000-7000-8000-000000000023",
        title: "Applied role",
        stage: "applied",
        updatedAt: "2026-10-14T04:00:00.000Z",
      }),
    ])
    renderApp("/apply?view=list")
    expect(await screen.findByText("Saved today")).toBeInTheDocument()
    expect(screen.getByText("Apply by Nov 8")).toBeInTheDocument()
    expect(screen.getByText("Applied Oct 14")).toBeInTheDocument()
  })

  it("restores URL filters and matching jobs after returning from a job", async () => {
    const matching = mockJob({
      id: "01900000-0000-7000-8000-000000000041",
      title: "Northwind Hanoi role",
      company: "Northwind Labs",
      location: "Hanoi",
    })
    const sameCompany = mockJob({
      id: "01900000-0000-7000-8000-000000000042",
      title: "Northwind Da Nang role",
      company: "Northwind Labs",
      location: "Da Nang",
      position: "a1",
    })
    const otherCompany = mockJob({
      id: "01900000-0000-7000-8000-000000000043",
      title: "Other Hanoi role",
      company: "Another company",
      location: "Hanoi",
      position: "a2",
    })
    setMockJobs([matching, sameCompany, otherCompany])
    const { router } = renderApp("/apply?view=list")
    await screen.findByRole("region", { name: "Saved" })
    await userEvent.click(screen.getByRole("button", { name: "Filter" }))
    await userEvent.type(screen.getByLabelText("Company"), "NORTHWIND")
    await userEvent.type(screen.getByLabelText("Location"), "hAnOi")

    expect(router.state.location.search).toMatchObject({
      company: "NORTHWIND",
      location: "hAnOi",
    })
    expect(screen.getByRole("button", { name: "Filter" })).toHaveTextContent(
      "2"
    )
    expect(
      await screen.findByRole("button", { name: /Northwind Hanoi role/ })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /Northwind Da Nang role/ })
    ).not.toBeInTheDocument()

    await userEvent.click(
      screen.getByRole("button", { name: /Northwind Hanoi role/ })
    )
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/apply/${matching.id}`)
    })
    router.history.back()

    expect(
      await screen.findByRole("button", { name: /Northwind Hanoi role/ })
    ).toBeInTheDocument()
    expect(screen.getByText("NORTHWIND")).toBeInTheDocument()
    expect(screen.getByText("hAnOi")).toBeInTheDocument()
    expect(router.state.location.search).toMatchObject({
      company: "NORTHWIND",
      location: "hAnOi",
    })

    await userEvent.click(
      screen.getByRole("button", { name: "Remove location filter" })
    )
    expect(router.state.location.search).not.toHaveProperty("location")
    expect(router.state.location.search).toHaveProperty("company", "NORTHWIND")
    expect(screen.getByRole("button", { name: "Filter" })).toHaveTextContent(
      "1"
    )
    expect(
      await screen.findByRole("button", { name: /Northwind Da Nang role/ })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /Other Hanoi role/ })
    ).not.toBeInTheDocument()
  })

  it("shows every stage, collapses Offer and Closed, and expands on click", async () => {
    setMockJobs([
      mockJob({
        id: "01900000-0000-7000-8000-000000000031",
        title: "Closed role",
        stage: "closed",
      }),
      mockJob({
        id: "01900000-0000-7000-8000-000000000032",
        title: "Open role",
        stage: "saved",
      }),
    ])
    renderApp("/apply?view=list")
    const closed = await screen.findByRole("button", { name: /^Closed/ })
    expect(screen.getByRole("button", { name: /^Offer/ })).toHaveAttribute(
      "aria-expanded",
      "false"
    )
    expect(closed).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByRole("button", { name: /Closed role/ })).toBeNull()
    expect(
      screen.getByRole("button", { name: /Open role/ })
    ).toBeInTheDocument()
    await userEvent.click(closed)
    expect(closed).toHaveAttribute("aria-expanded", "true")
    expect(
      screen.getByRole("button", { name: /Closed role/ })
    ).toBeInTheDocument()
  })
})
