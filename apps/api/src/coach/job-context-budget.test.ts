import { describe, expect, it } from "vitest"

import {
  clippedText,
  CONTEXT_LINE_MAX_CHARS,
  JOB_NOTE_MAX_CHARS,
  jobContextLine,
  TRUNCATED_MARKER,
} from "./context.js"

const LABEL = "Job context (untrusted data): "

function parsed(line: string) {
  return JSON.parse(line.slice(LABEL.length)) as {
    note: string
    title: string
    description: string | null
    posting: Record<string, string> | null
  }
}

function jobRow(fields: Record<string, unknown>) {
  return {
    id: "job-1",
    title: "Data Analyst",
    company: "Northwind",
    description: "",
    posting: null,
    note: "",
    checklist: [],
    linked: { cv: null, letter: null },
    ...fields,
  }
}

describe("Job context budget", () => {
  it("keeps the notes whole and marks the posting cut when the posting is ten times the budget", () => {
    const notes = `Ask about the dashboard team. ${"n".repeat(3500)} END`
    const line = jobContextLine(
      jobRow({
        note: notes,
        description: "d".repeat(CONTEXT_LINE_MAX_CHARS * 10),
        posting: {
          about: "a".repeat(CONTEXT_LINE_MAX_CHARS * 10),
          duties: "u",
          requirements: "r",
          details: "t",
        },
      })
    )
    const payload = parsed(line)
    expect(payload.note).toBe(notes)
    expect(payload.title).toBe("Data Analyst")
    expect(payload.description?.endsWith(TRUNCATED_MARKER)).toBe(true)
    expect(Object.values(payload.posting ?? {})).toEqual([
      TRUNCATED_MARKER,
      TRUNCATED_MARKER,
      TRUNCATED_MARKER,
      TRUNCATED_MARKER,
    ])
    expect(line.length).toBeLessThanOrEqual(
      LABEL.length + CONTEXT_LINE_MAX_CHARS
    )
    expect(line.indexOf('"note"')).toBeLessThan(line.indexOf('"description"'))
  })

  it("truncates notes over their own bound with the marker", () => {
    const notes = "x".repeat(JOB_NOTE_MAX_CHARS * 2)
    const payload = parsed(jobContextLine(jobRow({ note: notes })))
    expect(payload.note.length).toBe(JOB_NOTE_MAX_CHARS)
    expect(payload.note.endsWith(TRUNCATED_MARKER)).toBe(true)
  })

  it("leaves a Job that fits untouched and unmarked", () => {
    const row = jobRow({
      note: "Short note",
      description: "Analyse sales data.",
      posting: {
        about: "About",
        duties: "Duties",
        requirements: "SQL",
        details: "Remote",
      },
    })
    const payload = parsed(jobContextLine(row))
    expect(payload).toMatchObject({
      note: "Short note",
      description: "Analyse sales data.",
      posting: row.posting,
    })
    expect(jobContextLine(row)).not.toContain(TRUNCATED_MARKER)
  })

  it("counts escaped characters so a posting full of quotes and newlines stays inside the line budget", () => {
    const line = jobContextLine(
      jobRow({ description: '"\n'.repeat(CONTEXT_LINE_MAX_CHARS) })
    )
    expect(parsed(line).description?.endsWith(TRUNCATED_MARKER)).toBe(true)
    expect(line.length).toBeLessThanOrEqual(
      LABEL.length + CONTEXT_LINE_MAX_CHARS
    )
  })

  it("clips to the encoded budget and marks the cut", () => {
    expect(clippedText("abcdef", 10)).toBe("abcdef")
    expect(clippedText("abcdef", 4)).toBe(`abc${TRUNCATED_MARKER}`)
    expect(clippedText('""""', 5)).toBe(`""${TRUNCATED_MARKER}`)
  })
})
