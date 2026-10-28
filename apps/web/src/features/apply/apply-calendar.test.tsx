import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { renderApp } from "@/test/render-app.tsx"
import { mockJob } from "@/test/apply-job-fixtures.ts"
import { setMockJobs } from "@/test/apply-jobs-mock.ts"

describe("apply calendar", () => {
  afterEach(() => {
    cleanup()
  })
  it("shows an interview in the visible week and Week sets span", async () => {
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
    const { router } = renderApp("/apply?view=calendar")
    expect(await screen.findByText("Week interview")).toBeInTheDocument()
    const dayLabel = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(
      new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12))
    )
    expect(screen.getByRole("group", { name: dayLabel })).toBeInTheDocument()
    expect(
      screen.getByRole("group", { name: "Week interview" })
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Week" }))
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({
        view: "calendar",
        span: "week",
      })
    })
    expect(await screen.findByText("Week interview")).toBeInTheDocument()
  })
})
