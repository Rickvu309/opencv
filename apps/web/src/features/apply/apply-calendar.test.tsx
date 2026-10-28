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
    const interviewHour = screen.getByRole("group", {
      name: `${dayLabel}, 10:00`,
    })
    expect(
      within(interviewHour).getByText("Week interview")
    ).toBeInTheDocument()
    expect(
      screen.getByRole("group", { name: `${dayLabel}, 11:00` })
    ).toBeEmptyDOMElement()
    expect(screen.getByRole("group", { name: dayLabel })).toBeInTheDocument()
  })

  it("keeps the month grid and month span when Month is selected", async () => {
    setMockJobs([mockJob({ title: "Saved job" })])
    const { router } = renderApp("/apply?view=calendar&span=week")
    fireEvent.click(await screen.findByRole("button", { name: "Month" }))
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
