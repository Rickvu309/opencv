import { cleanup, screen } from "@testing-library/react"
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
    renderApp("/app/apply?view=list")
    expect(await screen.findByText("Saved today")).toBeInTheDocument()
    expect(screen.getByText("Apply by Nov 8")).toBeInTheDocument()
    expect(screen.getByText("Applied Oct 14")).toBeInTheDocument()
  })
})
