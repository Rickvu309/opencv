import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { renderApp } from "@/test/render-app.tsx"
import { mockJob } from "@/test/apply-job-fixtures.ts"
import { setMockJobs } from "@/test/apply-jobs-mock.ts"

describe("apply calendar", () => {
  afterEach(() => {
    cleanup()
  })
  it("renders the week schedule rows and places interviews in their hour", async () => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date())
    const year = parts.find((part) => part.type === "year")?.value
    const month = parts.find((part) => part.type === "month")?.value
    const day = parts.find((part) => part.type === "day")?.value
    setMockJobs([
      mockJob({
        id: "01900000-0000-7000-8000-000000000031",
        title: "Week interview",
        stage: "interview",
        interviewAt: `${year}-${month}-${day}T03:00:00.000Z`,
      }),
    ])
    renderApp("/apply?view=calendar&span=week")
    const dayLabel = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(
      new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12))
    )
    expect(await screen.findByText("Week interview")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: /\d{4}/ })).toBeInTheDocument()
    expect(screen.getByText("All day")).toBeInTheDocument()
    expect(screen.getByText("8:00")).toBeInTheDocument()
    expect(screen.getByText("18:00")).toBeInTheDocument()
    const column = screen.getByRole("group", { name: dayLabel })
    const block = within(column).getByRole("group", { name: "Week interview" })
    expect(within(block).getByText("10:00 to 11:00")).toBeInTheDocument()
    expect(within(block).getByText("Lumière Cosmetics")).toBeInTheDocument()
  })

  it("places an evening interview at its own time, not in the 18:00 row", async () => {
    setMockJobs([
      mockJob({
        id: "01900000-0000-7000-8000-000000000032",
        title: "Evening interview",
        stage: "interview",
        interviewAt: "2026-10-30T13:00:00.000Z",
      }),
    ])
    renderApp("/apply?view=calendar&span=week&date=2026-10-30")
    const block = await screen.findByRole("group", {
      name: "Evening interview",
    })
    expect(within(block).getByText("20:00 to 21:00")).toBeInTheDocument()
    // 08:00 is the first row, so 20:00 sits 12 hours of 58px down (+1px inset).
    expect(block.style.top).toBe(`${12 * 58 + 1}px`)
    expect(screen.getByText("21:00")).toBeInTheDocument()
  })

  it("lists a deadline in the all day row", async () => {
    const day = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(new Date())
    setMockJobs([mockJob({ title: "Due job", deadline: day })])
    renderApp("/apply?view=calendar&span=week")
    const chip = await screen.findByText("Due job due")
    expect(chip.closest('[role="group"][aria-label$="all day"]')).not.toBeNull()
  })

  it("moves the week with the next and previous buttons", async () => {
    setMockJobs([mockJob({ title: "Saved job" })])
    renderApp("/apply?view=calendar&span=week")
    const title = await screen.findByRole("heading", { name: /\d{4}/ })
    const before = title.textContent
    fireEvent.click(screen.getByRole("button", { name: "Next week" }))
    await waitFor(() => expect(title.textContent).not.toBe(before))
    fireEvent.click(screen.getByRole("button", { name: "Previous week" }))
    await waitFor(() => expect(title.textContent).toBe(before))
  })

  it("shows month chips with the interview time and moves by month", async () => {
    const day = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(new Date())
    setMockJobs([
      mockJob({
        title: "Month interview",
        stage: "interview",
        interviewAt: `${day}T03:00:00.000Z`,
      }),
    ])
    renderApp("/apply?view=calendar&span=month")
    expect(await screen.findByText("10:00 Month interview")).toBeInTheDocument()
    const title = screen.getByRole("heading", { name: /\d{4}/ })
    const before = title.textContent
    fireEvent.click(screen.getByRole("button", { name: "Next month" }))
    await waitFor(() => expect(title.textContent).not.toBe(before))
    fireEvent.click(screen.getByRole("button", { name: "Today" }))
    await waitFor(() => expect(title.textContent).toBe(before))
  })

  it("keeps the month grid and month span when Month is selected", async () => {
    setMockJobs([mockJob({ title: "Saved job" })])
    const { router } = renderApp("/apply?view=calendar&span=week")
    fireEvent.click(await screen.findByRole("radio", { name: "Month" }))
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({
        view: "calendar",
        span: "month",
      })
    })
    expect(screen.getByText("Mon")).toBeInTheDocument()
    expect(screen.getByText("Sun")).toBeInTheDocument()
  })
})
