import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { renderApp } from "@/test/render-app.tsx"
import { mockJob } from "@/test/apply-job-fixtures.ts"
import {
  getMockJobPosts,
  getMockPreviews,
  setMockJobs,
} from "@/test/apply-jobs-mock.ts"

const posting = "https://careers.verify-posting.dev/associate-pm-intern"

async function openDialog(onRequest?: (input: RequestInfo | URL) => void) {
  renderApp("/app/apply", onRequest)
  fireEvent.click(await screen.findByRole("button", { name: "New job" }))
  return screen.findByRole("dialog", { name: "New job" })
}

function requestUrl(input: RequestInfo | URL) {
  if (typeof input === "string") return input
  if (input instanceof URL) return input.href
  if (typeof Request !== "undefined" && input instanceof Request)
    return input.url
  return String(input)
}

describe("new job dialog", () => {
  afterEach(() => {
    cleanup()
  })
  it("fills a readable link", async () => {
    const dialog = await openDialog()
    fireEvent.change(screen.getByLabelText("Paste the job link"), {
      target: { value: posting },
    })
    fireEvent.click(screen.getByRole("button", { name: "Paste" }))
    expect(await screen.findByText("Filled")).toBeInTheDocument()
    expect(screen.getByLabelText("Role title")).toHaveValue(
      "Associate Product Manager Intern"
    )
    expect(screen.getByLabelText("Company")).toHaveValue("Northwind Labs")
    expect(dialog).toBeInTheDocument()
  })

  it("asks for the company and disables Add job", async () => {
    await openDialog()
    fireEvent.change(screen.getByLabelText("Paste the job link"), {
      target: { value: "https://jobs.example/company-missing" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Paste" }))
    expect(
      await screen.findByText("Add the company name to save this job.")
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Add job" })).toBeDisabled()
  })

  it("offers Open and Add anyway for a duplicate", async () => {
    const existing = mockJob({
      jobUrl: posting,
      title: "Associate Product Manager Intern",
      company: "Northwind Labs",
    })
    setMockJobs([existing])
    await openDialog()
    fireEvent.change(screen.getByLabelText("Paste the job link"), {
      target: { value: posting },
    })
    fireEvent.click(screen.getByRole("button", { name: "Paste" }))
    expect(await screen.findByText("Already on your board")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Open" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Add anyway" }))
    await waitFor(() => {
      expect(
        getMockJobPosts().some(
          (post) => post.name === "job.create" && post.input.anyway === true
        )
      ).toBe(true)
    })
  })

  it("previews through the api and does not fetch the posting", async () => {
    const urls: string[] = []
    await openDialog((input) => {
      urls.push(requestUrl(input))
    })
    fireEvent.change(screen.getByLabelText("Paste the job link"), {
      target: { value: posting },
    })
    fireEvent.click(screen.getByRole("button", { name: "Paste" }))
    await waitFor(() => {
      expect(getMockPreviews().some((preview) => preview.url === posting)).toBe(
        true
      )
    })
    expect(urls.some((url) => url.includes("/api/jobs/preview"))).toBe(true)
    expect(urls.some((url) => url.includes("careers.verify-posting.dev"))).toBe(
      false
    )
  })
})
