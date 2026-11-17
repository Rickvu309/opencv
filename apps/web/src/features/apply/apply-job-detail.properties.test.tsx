import {
  act,
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it } from "vitest"

import { renderApp } from "@/test/render-app.tsx"
import { mockJob } from "@/test/apply-job-fixtures.ts"
import {
  deferNextJobUpdate,
  getMockJobPosts,
  getMockJobs,
  rejectNextJobUpdate,
  setMockJobs,
} from "@/test/apply-jobs-mock.ts"

const id = "01900000-0000-7000-8000-000000000041"

function submitForm(input: HTMLElement) {
  const form = input.closest("form")
  if (!form) throw new Error("Input must be inside a form")
  fireEvent.submit(form)
}

describe("job property drafts", () => {
  afterEach(cleanup)
  it.each(["Recruiter", "Location"])(
    "keeps a full 201-character %s draft and saves its corrected 200-character value",
    async (label) => {
      setMockJobs([
        mockJob({
          id,
          title: "Junior Marketing",
          company: "Lumière",
          location: "Hanoi",
          recruiterName: "Minh Tran",
        }),
      ])
      renderApp(`/apply/${id}`)
      const saved = label === "Recruiter" ? "Minh Tran" : "Hanoi"
      const field = label === "Recruiter" ? "recruiterName" : "location"
      fireEvent.click(
        await screen.findByRole("button", { name: `${label}: ${saved}` })
      )
      const input = await screen.findByRole("textbox", { name: label })
      const draft = "x".repeat(201)
      fireEvent.change(input, { target: { value: draft } })
      submitForm(input)

      expect(draft).toHaveLength(201)
      expect(input).toHaveValue(draft)
      expect(await screen.findByRole("alert")).toHaveTextContent(
        `${label} must be 200 characters or fewer.`
      )
      expect(
        getMockJobPosts().filter((post) => post.name === "job.update")
      ).toHaveLength(0)

      const corrected = "x".repeat(200)
      fireEvent.change(input, { target: { value: corrected } })
      expect(screen.queryByRole("alert")).toBeNull()
      submitForm(input)

      expect(
        await screen.findByRole("button", { name: `${label}: ${corrected}` })
      ).toBeInTheDocument()
      expect(screen.queryByRole("textbox", { name: label })).toBeNull()
      expect(getMockJobs()[0]).toMatchObject({ [field]: corrected })
      expect(
        getMockJobPosts().filter((post) => post.name === "job.update")
      ).toHaveLength(1)
    }
  )

  it("keeps an invalid click-away draft open and lets Escape cancel it", async () => {
    const user = userEvent.setup()
    setMockJobs([
      mockJob({ id, title: "Junior Marketing", recruiterName: "Minh Tran" }),
    ])
    renderApp(`/apply/${id}`)
    await user.click(
      await screen.findByRole("button", { name: "Recruiter: Minh Tran" })
    )
    const input = await screen.findByRole("textbox", { name: "Recruiter" })
    const draft = "x".repeat(201)
    fireEvent.change(input, { target: { value: draft } })
    await user.click(screen.getByRole("heading", { name: "Junior Marketing" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Recruiter must be 200 characters or fewer."
    )
    expect(input).toHaveValue(draft)
    expect(input).toBeInTheDocument()
    expect(
      getMockJobPosts().filter((post) => post.name === "job.update")
    ).toHaveLength(0)

    await user.keyboard("{Escape}")
    await waitFor(() => {
      expect(screen.queryByRole("textbox", { name: "Recruiter" })).toBeNull()
    })
    await user.click(
      screen.getByRole("button", { name: "Recruiter: Minh Tran" })
    )
    expect(
      await screen.findByRole("textbox", { name: "Recruiter" })
    ).toHaveValue("Minh Tran")
  })

  it("keeps a failed property save editable and saves a retry", async () => {
    setMockJobs([
      mockJob({ id, title: "Junior Marketing", recruiterName: "Minh Tran" }),
    ])
    rejectNextJobUpdate()
    renderApp(`/apply/${id}`)
    fireEvent.click(
      await screen.findByRole("button", { name: "Recruiter: Minh Tran" })
    )
    const input = await screen.findByRole("textbox", { name: "Recruiter" })
    fireEvent.change(input, { target: { value: "New Recruiter" } })
    submitForm(input)

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not save recruiter. Try again."
    )
    expect(input).toHaveValue("New Recruiter")
    expect(input).toBeEnabled()
    expect(getMockJobs()[0]).toMatchObject({ recruiterName: "Minh Tran" })

    submitForm(input)
    expect(
      await screen.findByRole("button", { name: "Recruiter: New Recruiter" })
    ).toBeInTheDocument()
    expect(screen.queryByRole("textbox", { name: "Recruiter" })).toBeNull()
    expect(getMockJobs()[0]).toMatchObject({ recruiterName: "New Recruiter" })
    expect(
      getMockJobPosts().filter((post) => post.name === "job.update")
    ).toHaveLength(2)
  })

  it.each(["success", "failure"])(
    "ignores Escape, click-away, and repeated submits until a pending save settles with %s",
    async (outcome) => {
      const user = userEvent.setup()
      setMockJobs([
        mockJob({ id, title: "Junior Marketing", recruiterName: "Minh Tran" }),
      ])
      renderApp(`/apply/${id}`)
      const trigger = await screen.findByRole("button", {
        name: "Recruiter: Minh Tran",
      })
      await user.click(trigger)
      const input = await screen.findByRole("textbox", { name: "Recruiter" })
      fireEvent.change(input, { target: { value: "New Recruiter" } })
      const release = deferNextJobUpdate()
      if (outcome === "failure") rejectNextJobUpdate()
      submitForm(input)
      try {
        await waitFor(() => {
          expect(
            getMockJobPosts().filter((post) => post.name === "job.update")
          ).toHaveLength(1)
        })
        expect(input).toBeDisabled()
        await user.keyboard("{Escape}")
        await user.click(
          screen.getByRole("heading", { name: "Junior Marketing" })
        )
        await user.click(trigger)
        await act(async () => {
          submitForm(input)
        })
        expect(screen.getByRole("textbox", { name: "Recruiter" })).toBe(input)
        expect(input).toHaveValue("New Recruiter")
        expect(input).toBeDisabled()
        expect(
          getMockJobPosts().filter((post) => post.name === "job.update")
        ).toHaveLength(1)
      } finally {
        await act(async () => {
          release()
        })
      }

      if (outcome === "success") {
        expect(
          await screen.findByRole("button", {
            name: "Recruiter: New Recruiter",
          })
        ).toBeInTheDocument()
        expect(screen.queryByRole("textbox", { name: "Recruiter" })).toBeNull()
        expect(getMockJobs()[0]).toMatchObject({
          recruiterName: "New Recruiter",
        })
      } else {
        expect(await screen.findByRole("alert")).toHaveTextContent(
          "Could not save recruiter. Try again."
        )
        expect(input).toHaveValue("New Recruiter")
        expect(input).toBeEnabled()
        await user.keyboard("{Escape}")
        await waitFor(() => {
          expect(
            screen.queryByRole("textbox", { name: "Recruiter" })
          ).toBeNull()
        })
        await user.click(trigger)
        expect(
          await screen.findByRole("textbox", { name: "Recruiter" })
        ).toHaveValue("Minh Tran")
      }
      expect(
        getMockJobPosts().filter((post) => post.name === "job.update")
      ).toHaveLength(1)
    }
  )

  it.each([
    {
      label: "Interview",
      value: "2026-11-05T10:30",
      field: "interviewAt",
      saved: "2026-11-05T03:30:00.000Z",
    },
    {
      label: "Deadline",
      value: "2026-11-06",
      field: "deadline",
      saved: "2026-11-06",
    },
  ])(
    "saves the shared $label editor without a text validator",
    async ({ label, value, field, saved }) => {
      setMockJobs([mockJob({ id, title: "Junior Marketing" })])
      renderApp(`/apply/${id}`)
      fireEvent.click(
        await screen.findByRole("button", {
          name: `Add ${label.toLowerCase()}`,
        })
      )
      const editor = await screen.findByRole("dialog", { name: label })
      const input = within(editor).getByLabelText(label)
      fireEvent.change(input, { target: { value } })
      submitForm(input)

      await waitFor(() => {
        expect(getMockJobs()[0]).toMatchObject({ [field]: saved })
        expect(screen.queryByRole("dialog", { name: label })).toBeNull()
      })
      expect(
        getMockJobPosts().filter((post) => post.name === "job.update")
      ).toHaveLength(1)
    }
  )
})
