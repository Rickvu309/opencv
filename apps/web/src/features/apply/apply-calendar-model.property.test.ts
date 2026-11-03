import fc from "fast-check"
import { describe, expect, it } from "vitest"

import { mockJob } from "@/test/apply-job-fixtures.ts"

import {
  blockSpan,
  calendarEvents,
  eventsInDays,
  hoursFor,
  monthWeeks,
  rangeFor,
  weekDays,
} from "./apply-calendar-model.ts"

const HO_CHI_MINH_MS = 7 * 3_600_000
const DAY_MS = 86_400_000
const FIRST = Date.UTC(2023, 0, 1)
const LAST = Date.UTC(2029, 11, 31)

const instant = fc.integer({ min: FIRST, max: LAST })

const localDate = (ms: number) =>
  new Date(ms + HO_CHI_MINH_MS).toISOString().slice(0, 10)
const localMinutes = (ms: number) =>
  Math.floor(((((ms + HO_CHI_MINH_MS) % DAY_MS) + DAY_MS) % DAY_MS) / 60_000)
const iso = (ms: number) => new Date(ms).toISOString()
const interviewAt = (ms: number) =>
  mockJob({ stage: "interview", interviewAt: iso(ms) })

describe("calendar time in the profile zone", () => {
  it("puts an interview on the day and minute it has in Ho Chi Minh", () => {
    fc.assert(
      fc.property(instant, (ms) => {
        const [event] = calendarEvents([interviewAt(ms)])
        expect(event?.day).toBe(localDate(ms))
        expect(event?.startMinutes).toBe(localMinutes(ms))
        expect(event?.endMinutes).toBe(localMinutes(ms) + 60)
      }),
      { numRuns: 2000 }
    )
  })

  it("builds each week from Monday to Sunday around its anchor", () => {
    fc.assert(
      fc.property(instant, (ms) => {
        const anchor = localDate(ms)
        const days = weekDays(anchor)
        expect(days).toHaveLength(7)
        expect(days).toContain(anchor)
        expect(new Date(`${days[0]}T12:00:00Z`).getUTCDay()).toBe(1)
        days.forEach((day, index) => {
          expect(day).toBe(
            localDate(
              Date.parse(`${days[0]}T12:00:00Z`) +
                index * DAY_MS -
                HO_CHI_MINH_MS
            )
          )
        })
      }),
      { numRuns: 1000 }
    )
  })

  it("keeps an interview in the week of its local day, including Monday before 07:00", () => {
    fc.assert(
      fc.property(instant, instant, (at, anchorMs) => {
        const days = weekDays(localDate(anchorMs))
        const shown = eventsInDays(calendarEvents([interviewAt(at)]), days)
        expect(shown.length === 1).toBe(days.includes(localDate(at)))
      }),
      { numRuns: 3000 }
    )
    const mondayEarly = Date.parse("2026-10-25T23:30:00.000Z")
    expect(
      eventsInDays(
        calendarEvents([interviewAt(mondayEarly)]),
        weekDays("2026-10-26")
      )
    ).toHaveLength(1)
  })

  it("asks the server for exactly the local days of the week", () => {
    fc.assert(
      fc.property(instant, instant, (at, anchorMs) => {
        const days = weekDays(localDate(anchorMs))
        const { from, to } = rangeFor(days)
        const inRange = iso(at) >= from && iso(at) < to
        expect(inRange).toBe(days.includes(localDate(at)))
        expect(localMinutes(Date.parse(from))).toBe(0)
        expect(localDate(Date.parse(from))).toBe(days[0])
        expect(localMinutes(Date.parse(to))).toBe(0)
      }),
      { numRuns: 3000 }
    )
  })

  it("asks for every deadline shown, which the server reads as midnight UTC", () => {
    fc.assert(
      fc.property(instant, instant, (deadlineMs, anchorMs) => {
        const days = weekDays(localDate(anchorMs))
        const deadline = localDate(deadlineMs)
        const { from, to } = rangeFor(days)
        const read = `${deadline}T00:00:00.000Z`
        if (days.includes(deadline)) {
          expect(read >= from && read <= to).toBe(true)
        }
        const [event] = calendarEvents([mockJob({ deadline })])
        expect(eventsInDays([event!], days).length === 1).toBe(
          days.includes(deadline)
        )
      }),
      { numRuns: 3000 }
    )
  })

  it("covers every day of a month with whole Monday-first weeks the server range includes", () => {
    fc.assert(
      fc.property(instant, (ms) => {
        const anchor = localDate(ms)
        const weeks = monthWeeks(anchor)
        const flat = weeks.flat()
        expect(weeks.every((week) => week.length === 7)).toBe(true)
        expect(
          flat.filter((day) => day.slice(0, 7) === anchor.slice(0, 7)).length
        ).toBe(
          new Date(
            Date.UTC(Number(anchor.slice(0, 4)), Number(anchor.slice(5, 7)), 0)
          ).getUTCDate()
        )
        const { from, to } = rangeFor(flat)
        const at =
          Date.parse(`${anchor}T00:00:00.000Z`) - HO_CHI_MINH_MS + DAY_MS / 2
        expect(iso(at) >= from && iso(at) < to).toBe(true)
      }),
      { numRuns: 500 }
    )
  })

  it("draws every interview inside the hour rows, each labelled with a real hour", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 1439 }), {
          minLength: 1,
          maxLength: 4,
        }),
        (minutes) => {
          const events = calendarEvents(
            minutes.map((minute) =>
              interviewAt(
                Date.UTC(2026, 9, 28) - HO_CHI_MINH_MS + minute * 60_000
              )
            )
          )
          const hours = hoursFor(events)
          for (const event of events) {
            const span = blockSpan(event, hours)
            expect(span.top).toBeGreaterThanOrEqual(0)
            expect(span.length).toBeGreaterThan(0)
            expect(span.top + span.length).toBeLessThanOrEqual(
              hours.length * 60
            )
          }
          expect(hours.every((hour) => hour >= 0 && hour <= 23)).toBe(true)
        }
      ),
      { numRuns: 500 }
    )
  })
})
