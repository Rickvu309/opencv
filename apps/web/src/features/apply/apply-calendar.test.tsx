import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { renderApp } from "@/test/render-app.tsx"
import { mockJob } from "@/test/apply-job-fixtures.ts"
import { setMockJobs } from "@/test/apply-jobs-mock.ts"
import { calendarEvents, eventsInDays } from "./apply-calendar-model.ts"

const PINNED_NOW = new Date("2026-10-29T05:00:00.000Z")
const TODAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh",
}).format(PINNED_NOW)

const FIRST_ROW_HOUR = 8
const HOUR_ROW_PX = 58
const EVENT_INSET_PX = 1

const FAKE_DATE_ONLY_SO_WAITFOR_KEEPS_REAL_TIMERS: Parameters<
  typeof vi.useFakeTimers
>[0] = { toFake: ["Date"] }

describe("apply calendar", () => {
  beforeEach(() => {
    vi.useFakeTimers(FAKE_DATE_ONLY_SO_WAITFOR_KEEPS_REAL_TIMERS)
    vi.setSystemTime(PINNED_NOW)
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })
  it("renders the week schedule rows and places interviews in their hour", async () => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(PINNED_NOW)
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
    const block = within(column).getByRole("button", {
      name: "Interview 10:00 to 11:00: Week interview, Lumière Cosmetics",
    })
    expect(within(block).getByText("10:00 to 11:00")).toBeInTheDocument()
    expect(within(block).getByText("Lumière Cosmetics")).toBeInTheDocument()
  })

  it("places an evening interview at its own time, not in the 18:00 row", async () => {
    setMockJobs([
      mockJob({
        id: "01900000-0000-7000-8000-000000000032",
        title: "Evening interview",
        stage: "interview",
        interviewAt: `${TODAY}T13:00:00.000Z`,
      }),
    ])
    renderApp("/apply?view=calendar&span=week")
    const block = await screen.findByRole("button", {
      name: "Interview 20:00 to 21:00: Evening interview, Lumière Cosmetics",
    })
    expect(within(block).getByText("20:00 to 21:00")).toBeInTheDocument()
    expect(block.style.top).toBe(
      `${(20 - FIRST_ROW_HOUR) * HOUR_ROW_PX + EVENT_INSET_PX}px`
    )
    expect(screen.getByText("21:00")).toBeInTheDocument()
  })

  it("lists a deadline in the all day row", async () => {
    setMockJobs([mockJob({ title: "Due job", deadline: TODAY })])
    renderApp("/apply?view=calendar&span=week")
    const chip = await screen.findByText("Due job due")
    expect(chip.closest('[role="group"][aria-label$="all day"]')).not.toBeNull()
  })

  it("moves the week and its day columns with the next and previous buttons", async () => {
    setMockJobs([mockJob({ title: "Saved job" })])
    renderApp("/apply?view=calendar&span=week")
    const title = await screen.findByRole("heading", { name: /\d{4}/ })
    const before = title.textContent
    const dayColumnLabels = () =>
      screen
        .getAllByRole("group")
        .map((group) => group.getAttribute("aria-label"))
        .filter((label) =>
          /^[A-Z][a-z]{2}, [A-Z][a-z]{2} \d+$/.test(label ?? "")
        )
    const thisWeek = dayColumnLabels()
    expect(thisWeek).toHaveLength(7)
    fireEvent.click(screen.getByRole("button", { name: "Next week" }))
    await waitFor(() => expect(dayColumnLabels()).not.toEqual(thisWeek))
    const nextWeek = dayColumnLabels()
    expect(nextWeek).toHaveLength(7)
    expect(nextWeek.some((label) => thisWeek.includes(label))).toBe(false)
    fireEvent.click(screen.getByRole("button", { name: "Previous week" }))
    await waitFor(() => expect(dayColumnLabels()).toEqual(thisWeek))
    expect(title.textContent).toBe(before)
  })

  it("shows month chips with the interview time and moves by month", async () => {
    setMockJobs([
      mockJob({
        title: "Month interview",
        stage: "interview",
        interviewAt: `${TODAY}T03:00:00.000Z`,
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

  it("keeps only events on the displayed local calendar days", () => {
    const firstDay = mockJob({
      id: "01900000-0000-7000-8000-000000000041",
      interviewAt: "2026-10-25T23:30:00.000Z",
    })
    const lastDay = mockJob({
      id: "01900000-0000-7000-8000-000000000042",
      deadline: "2026-11-01",
    })
    const adjacentDay = mockJob({
      id: "01900000-0000-7000-8000-000000000043",
      deadline: "2026-11-02",
    })
    const visible = eventsInDays(
      calendarEvents([firstDay, lastDay, adjacentDay]),
      [
        "2026-10-26",
        "2026-10-27",
        "2026-10-28",
        "2026-10-29",
        "2026-10-30",
        "2026-10-31",
        "2026-11-01",
      ]
    )
    expect(visible.map((event) => event.day)).toEqual([
      "2026-10-26",
      "2026-11-01",
    ])
  })

  it("opens a month event's full job detail with its keyboard button", async () => {
    const job = mockJob({
      id: "01900000-0000-7000-8000-000000000044",
      title: "A very long product role title that cannot fit in the month cell",
      deadline: TODAY,
    })
    setMockJobs([job])
    const { router } = renderApp("/apply?view=calendar&span=month")
    const user = userEvent.setup()
    const event = await screen.findByRole("button", {
      name: `Deadline: ${job.title}, ${job.company}`,
    })
    event.focus()
    expect(event).toHaveFocus()
    await user.keyboard("{Enter}")
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/apply/${job.id}`)
    )
    expect(
      await within(
        await screen.findByRole("navigation", { name: "Breadcrumb" })
      ).findByText(job.title)
    ).toBeInTheDocument()
  })

  it("shows actual early and late interview times and retains the 18:30 start", async () => {
    setMockJobs([
      mockJob({
        id: "01900000-0000-7000-8000-000000000051",
        title: "Early",
        interviewAt: `${TODAY}T00:00:00.000Z`,
      }),
      mockJob({
        id: "01900000-0000-7000-8000-000000000052",
        title: "Day",
        interviewAt: `${TODAY}T03:00:00.000Z`,
      }),
      mockJob({
        id: "01900000-0000-7000-8000-000000000053",
        title: "Evening",
        interviewAt: `${TODAY}T11:00:00.000Z`,
      }),
      mockJob({
        id: "01900000-0000-7000-8000-000000000054",
        title: "Boundary",
        interviewAt: `${TODAY}T11:30:00.000Z`,
      }),
      mockJob({
        id: "01900000-0000-7000-8000-000000000055",
        title: "Night",
        interviewAt: `${TODAY}T13:00:00.000Z`,
      }),
    ])
    renderApp("/apply?view=calendar&span=week")
    expect(
      await screen.findByRole("button", {
        name: /Interview 7:00 to 8:00: Early/,
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /Interview 10:00 to 11:00: Day/ })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /Interview 18:00 to 19:00: Evening/ })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /Interview 18:30 to 19:30: Boundary/ })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /Interview 20:00 to 21:00: Night/ })
    ).toBeInTheDocument()
  })
})
