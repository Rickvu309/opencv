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
import { getMockJobPosts, setMockJobs } from "@/test/apply-jobs-mock.ts"

const id = "01900000-0000-7000-8000-000000000041"
const other = "01900000-0000-7000-8000-000000000042"

describe("job detail", () => {
  afterEach(() => {
    cleanup()
  })
  it("walks jobs, toggles the checklist, adds a note, and can move to Closed", async () => {
    setMockJobs([
      {
        ...mockJob({
          id,
          title: "Junior Marketing",
          company: "Lumière Cosmetics",
          stage: "saved",
          position: "a0",
          description: "A posting paragraph.",
        }),
        checklist: [
          {
            id: "01900000-0000-7000-8000-000000000043",
            label: "Practise three PM questions",
            done: false,
            position: "a0",
          },
        ],
        activity: [
          {
            id: "01900000-0000-7000-8000-000000000044",
            createdAt: "2026-10-27T02:00:00.000Z",
            actor: "person",
            command: "job.create",
            subjectKind: "job",
            subjectId: id,
            summary: "You added this job from the board",
            undoneAt: null,
          },
        ],
      },
      mockJob({
        id: other,
        title: "Next role",
        company: "Contoso",
        stage: "applied",
        position: "a0",
      }),
    ])
    renderApp(`/app/apply/${id}`)
    const crumb = await screen.findByRole("navigation", { name: "Breadcrumb" })
    expect(
      within(crumb).getByRole("link", { name: "Apply" })
    ).toBeInTheDocument()
    expect(
      within(crumb).getByRole("button", { name: "Previous job" })
    ).toBeDisabled()
    expect(
      within(crumb).getByRole("button", { name: "Next job" })
    ).toBeEnabled()
    expect(
      within(crumb).getByRole("button", { name: "Favorite" })
    ).toBeInTheDocument()
    expect(
      screen.getByText("You added this job from the board")
    ).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Practise three PM questions" })
    )
    await waitFor(() => {
      expect(
        getMockJobPosts().some(
          (post) =>
            post.name === "job.setChecklistItem" && post.input.done === true
        )
      ).toBe(true)
    })
    fireEvent.change(screen.getByRole("textbox", { name: "Leave a note" }), {
      target: { value: "Bring the checkout study." },
    })
    fireEvent.click(screen.getByRole("button", { name: "Add note" }))
    await waitFor(() => {
      expect(
        getMockJobPosts().some(
          (post) =>
            post.name === "job.addNote" &&
            post.input.body === "Bring the checkout study."
        )
      ).toBe(true)
    })
    fireEvent.click(screen.getByRole("button", { name: "More" }))
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete job" }))
    const dialog = await screen.findByRole("dialog", {
      name: "Delete Junior Marketing?",
    })
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Move to Closed" })
    )
    await waitFor(() => {
      expect(
        getMockJobPosts().some(
          (post) => post.name === "job.move" && post.input.stage === "closed"
        )
      ).toBe(true)
    })
  })
})
