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
import {
  getMockJobPosts,
  getMockPreviews,
  setMockJobs,
} from "@/test/apply-jobs-mock.ts"

const posting = "https://careers.verify-posting.dev/associate-pm-intern"

async function openDialog(onRequest?: (input: RequestInfo | URL) => void) {
  renderApp("/apply", onRequest)
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
    fireEvent.blur(screen.getByLabelText("Paste the job link"))
    expect(await screen.findByText("Filled")).toBeInTheDocument()
    expect(screen.getByLabelText("Role title")).toHaveValue(
      "Associate Product Manager Intern"
    )
    expect(screen.getByLabelText("Company")).toHaveValue("Northwind Labs")
    expect(dialog).toBeInTheDocument()
  })

  it("asks for the company and keeps Add job available", async () => {
    await openDialog()
    fireEvent.change(screen.getByLabelText("Paste the job link"), {
      target: { value: "https://jobs.example/company-missing" },
    })
    fireEvent.blur(screen.getByLabelText("Paste the job link"))
    expect(
      await screen.findByText("Add the company name to save this job.")
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Add job" })).toBeEnabled()
  })

  it("shows the hint when Add job is pressed without a company", async () => {
    await openDialog()
    fireEvent.change(screen.getByLabelText("Role title"), {
      target: { value: "Junior Marketing" },
    })
    expect(
      screen.queryByText("Add the company name to save this job.")
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Add job" }))
    expect(
      await screen.findByText("Add the company name to save this job.")
    ).toBeInTheDocument()
    expect(screen.getByLabelText("Company")).toHaveFocus()
    expect(getMockJobPosts().some((post) => post.name === "job.create")).toBe(
      false
    )
  })

  it("pastes the link from the clipboard", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { readText: async () => posting },
    })
    await openDialog()
    fireEvent.click(screen.getByRole("button", { name: "Paste" }))
    expect(await screen.findByText("Filled")).toBeInTheDocument()
    expect(screen.getByLabelText("Paste the job link")).toHaveValue(
      posting.replace("https://", "")
    )
    expect(getMockPreviews().some((preview) => preview.url === posting)).toBe(
      true
    )
  })

  it("sets the stage, deadline and sends them on create", async () => {
    await openDialog()
    fireEvent.change(screen.getByLabelText("Role title"), {
      target: { value: "Junior Marketing" },
    })
    fireEvent.change(screen.getByLabelText("Company"), {
      target: { value: "Lumière Cosmetics" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Deadline" }))
    const deadline = await screen.findByRole("dialog", { name: "Deadline" })
    fireEvent.change(within(deadline).getByLabelText("Deadline"), {
      target: { value: "2026-11-15" },
    })
    expect(screen.getByRole("button", { name: "Nov 15" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Add job" }))
    await waitFor(() => {
      expect(
        getMockJobPosts().some(
          (post) =>
            post.name === "job.create" && post.input.deadline === "2026-11-15"
        )
      ).toBe(true)
    })
  })

  it("adds a location to a job typed by hand", async () => {
    await openDialog()
    fireEvent.change(screen.getByLabelText("Role title"), {
      target: { value: "Junior Marketing" },
    })
    fireEvent.change(screen.getByLabelText("Company"), {
      target: { value: "Lumière Cosmetics" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Location" }))
    fireEvent.change(await screen.findByRole("textbox", { name: "Location" }), {
      target: { value: "Da Nang" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Add job" }))
    await waitFor(() => {
      expect(
        getMockJobPosts().some(
          (post) =>
            post.name === "job.create" && post.input.location === "Da Nang"
        )
      ).toBe(true)
    })
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
    fireEvent.blur(screen.getByLabelText("Paste the job link"))
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
    fireEvent.blur(screen.getByLabelText("Paste the job link"))
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

  it("sends the preview location on create", async () => {
    await openDialog()
    fireEvent.change(screen.getByLabelText("Paste the job link"), {
      target: { value: posting },
    })
    fireEvent.blur(screen.getByLabelText("Paste the job link"))
    expect(await screen.findByText("Filled")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Add job" }))
    await waitFor(() => {
      expect(
        getMockJobPosts().some(
          (post) =>
            post.name === "job.create" && post.input.location === "Hanoi"
        )
      ).toBe(true)
    })
  })

  it("rejects title and company over the contract limit before creating", async () => {
    await openDialog()
    fireEvent.change(screen.getByLabelText("Role title"), {
      target: { value: ` ${"T".repeat(201)} ` },
    })
    fireEvent.change(screen.getByLabelText("Company"), {
      target: { value: "Northwind Labs" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Add job" }))
    expect(
      await screen.findByText(/200 characters or fewer/i)
    ).toBeInTheDocument()
    expect(screen.getByLabelText("Role title")).toHaveFocus()
    expect(getMockJobPosts().some((post) => post.name === "job.create")).toBe(
      false
    )
    expect(screen.getByLabelText("Role title")).toHaveValue(
      ` ${"T".repeat(201)} `
    )

    fireEvent.change(screen.getByLabelText("Role title"), {
      target: { value: ` ${"T".repeat(200)} ` },
    })
    fireEvent.click(screen.getByRole("button", { name: "Add job" }))
    await waitFor(() => {
      expect(getMockJobPosts().some((post) => post.name === "job.create")).toBe(
        true
      )
    })
    expect(
      getMockJobPosts().find((post) => post.name === "job.create")?.input.title
    ).toBe("T".repeat(200))
  })

  it("rejects an overlong company before creating and accepts the boundary", async () => {
    await openDialog()
    fireEvent.change(screen.getByLabelText("Role title"), {
      target: { value: "Role" },
    })
    fireEvent.change(screen.getByLabelText("Company"), {
      target: { value: "C".repeat(201) },
    })
    fireEvent.click(screen.getByRole("button", { name: "Add job" }))
    expect(
      await screen.findByText(/200 characters or fewer/i)
    ).toBeInTheDocument()
    expect(screen.getByLabelText("Company")).toHaveFocus()
    expect(screen.getByLabelText("Company")).toHaveAttribute(
      "aria-describedby",
      "job-company-error"
    )
    expect(getMockJobPosts().some((post) => post.name === "job.create")).toBe(
      false
    )
    expect(screen.getByLabelText("Company")).toHaveValue("C".repeat(201))
    fireEvent.change(screen.getByLabelText("Company"), {
      target: { value: ` ${"C".repeat(200)} ` },
    })
    fireEvent.click(screen.getByRole("button", { name: "Add job" }))
    await waitFor(() => {
      expect(getMockJobPosts().some((post) => post.name === "job.create")).toBe(
        true
      )
    })
    expect(
      getMockJobPosts().find((post) => post.name === "job.create")?.input
        .company
    ).toBe("C".repeat(200))
  })

  it("shows a safe save error and keeps the draft after a rejected create", async () => {
    let shouldReject = true
    await openDialog((input) => {
      if (
        shouldReject &&
        requestUrl(input).includes("/api/commands/job.create")
      ) {
        shouldReject = false
        throw new Error("sensitive server detail")
      }
    })
    fireEvent.change(screen.getByLabelText("Role title"), {
      target: { value: "Kept title" },
    })
    fireEvent.change(screen.getByLabelText("Company"), {
      target: { value: "Kept company" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Add job" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /couldn’t save this job/i
    )
    expect(screen.getByRole("alert")).not.toHaveTextContent(
      "sensitive server detail"
    )
    expect(screen.getByLabelText("Role title")).toHaveValue("Kept title")
    expect(screen.getByLabelText("Company")).toHaveValue("Kept company")

    fireEvent.change(screen.getByLabelText("Role title"), {
      target: { value: "Corrected title" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Add job" }))
    await waitFor(() => {
      expect(getMockJobPosts().some((post) => post.name === "job.create")).toBe(
        true
      )
    })
  })

  it("validates the description using the create schema", async () => {
    await openDialog()
    fireEvent.change(screen.getByLabelText("Role title"), {
      target: { value: "Role" },
    })
    fireEvent.change(screen.getByLabelText("Company"), {
      target: { value: "Company" },
    })
    fireEvent.change(screen.getByLabelText("Add the job description"), {
      target: { value: "D".repeat(20_001) },
    })
    fireEvent.click(screen.getByRole("button", { name: "Add job" }))
    expect(
      await screen.findByText(/20000 characters or fewer/i)
    ).toBeInTheDocument()
    expect(getMockJobPosts().some((post) => post.name === "job.create")).toBe(
      false
    )
  })

  it("names the existing stage and describes the company error", async () => {
    setMockJobs([
      mockJob({
        jobUrl: posting,
        stage: "interview",
        title: "Associate Product Manager Intern",
        company: "Northwind Labs",
      }),
    ])
    await openDialog()
    fireEvent.change(screen.getByLabelText("Paste the job link"), {
      target: { value: posting },
    })
    fireEvent.blur(screen.getByLabelText("Paste the job link"))
    expect(
      await screen.findByText(
        /Associate Product Manager Intern at Northwind Labs, in Interview/
      )
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    fireEvent.click(await screen.findByRole("button", { name: "New job" }))
    expect(screen.queryByText(/Already on your board/)).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("Paste the job link"), {
      target: { value: "https://jobs.example/company-missing" },
    })
    fireEvent.blur(screen.getByLabelText("Paste the job link"))
    const error = await screen.findByText(
      "Add the company name to save this job."
    )
    expect(error).toHaveAttribute("id", "job-company-error")
    expect(screen.getByLabelText("Company")).toHaveAttribute(
      "aria-describedby",
      "job-company-error"
    )
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    fireEvent.click(await screen.findByRole("button", { name: "New job" }))
    expect(
      screen.queryByText("Add the company name to save this job.")
    ).not.toBeInTheDocument()
  })

  it("opens the existing job when create reports a duplicate", async () => {
    const existing = mockJob({
      id: "01900000-0000-7000-8000-000000000077",
      stage: "interview",
      title: "Kept role",
      company: "Northwind Labs",
    })
    setMockJobs([existing])
    const { router } = renderApp("/apply")
    fireEvent.click(await screen.findByRole("button", { name: "New job" }))
    fireEvent.change(screen.getByLabelText("Paste the job link"), {
      target: { value: "https://jobs.example/create-duplicate" },
    })
    fireEvent.blur(screen.getByLabelText("Paste the job link"))
    expect(await screen.findByText("Filled")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Add job" }))
    expect(
      await screen.findByText(/Kept role at Northwind Labs, in Interview/)
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Open" }))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/apply/${existing.id}`)
    })
  })
})
