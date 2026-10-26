import { describe, expect, it } from "vitest"

import { matchInboxJob } from "./match.js"

describe("matchInboxJob", () => {
  it("matches the only job at a company and keeps an interview suggestion", () => {
    expect(
      matchInboxJob(
        {
          company: "Local startup",
          role: "Associate PM",
          summary: "Interview invite, Thu 10:00",
          suggestedStage: "interview",
        },
        [{ id: "job-1", title: "Associate PM", company: "Local startup" }]
      )
    ).toEqual({ jobId: "job-1", suggestedStage: "interview" })
  })

  it("drops the suggestion when the summary is a rejection", () => {
    expect(
      matchInboxJob(
        {
          company: "Agency",
          role: "Content Specialist",
          summary: "Not moving forward",
          suggestedStage: null,
        },
        [{ id: "job-1", title: "Writer", company: "Agency" }]
      )
    ).toEqual({ jobId: "job-1", suggestedStage: null })
  })

  it("ignores interview wording when no job matches", () => {
    expect(
      matchInboxJob(
        {
          company: "Other",
          role: "Associate PM",
          summary: "Interview invite",
          suggestedStage: "interview",
        },
        [{ id: "job-1", title: "Associate PM", company: "Local startup" }]
      )
    ).toEqual({ jobId: null, suggestedStage: null })
  })

  it("compares companies without diacritics", () => {
    expect(
      matchInboxJob(
        {
          company: "Lumière",
          role: "Marketing Executive",
          summary: "Closes in 2 days",
          suggestedStage: null,
        },
        [{ id: "job-1", title: "Designer", company: "Lumiere" }]
      ).jobId
    ).toBe("job-1")
  })

  it("requires a shared long word when the company has several jobs", () => {
    expect(
      matchInboxJob(
        {
          company: "Northwind",
          role: "Analyst",
          summary: "Hello",
          suggestedStage: null,
        },
        [
          { id: "a", title: "Designer", company: "Northwind" },
          { id: "b", title: "Writer", company: "Northwind" },
        ]
      ).jobId
    ).toBeNull()
    expect(
      matchInboxJob(
        {
          company: "Northwind",
          role: "Marketing Executive",
          summary: "Hello",
          suggestedStage: null,
        },
        [
          { id: "a", title: "Marketing lead", company: "Northwind" },
          { id: "b", title: "Writer", company: "Northwind" },
        ]
      ).jobId
    ).toBe("a")
  })
})
