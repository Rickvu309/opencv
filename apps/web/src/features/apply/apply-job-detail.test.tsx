import { parsePaperId } from "@workspace/domain/kernel"
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { appNotifications, findAppMain } from "@/test/app-regions.ts"
import { renderApp } from "@/test/render-app.tsx"
import { setMockTimeZone } from "@/test/profile-api-mock.ts"
import { mockJob } from "@/test/apply-job-fixtures.ts"
import {
  getMockJobPosts,
  refuseNextUndoWith,
  rejectNextChecklistItem,
  rejectNextNote,
  setMockJobs,
} from "@/test/apply-jobs-mock.ts"

const id = "01900000-0000-7000-8000-000000000041"
const other = "01900000-0000-7000-8000-000000000042"

function submitPrepStep(input: HTMLElement) {
  const form = input.closest("form")
  if (!form) throw new Error("Prep step input must be inside a form")
  fireEvent.submit(form)
}

async function headerBar() {
  const crumb = await screen.findByRole("navigation", { name: "Breadcrumb" })
  return crumb.closest("header") as HTMLElement
}

describe("job detail", () => {
  afterEach(() => {
    cleanup()
  })
  it("sets priority through the command and restores it with Undo", async () => {
    setMockJobs([mockJob({ id, priority: "normal" })])
    renderApp(`/apply/${id}`)
    const page = await findAppMain()
    fireEvent.click(
      await page.findByRole("button", { name: "Priority: Normal" })
    )
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "High priority" })
    )
    expect(
      await page.findByRole("button", { name: "Priority: High priority" })
    ).toBeVisible()
    expect(getMockJobPosts()).toContainEqual(
      expect.objectContaining({
        name: "job.setPriority",
        input: { jobId: id, priority: "high" },
      })
    )
    fireEvent.click(
      await appNotifications().findByRole("button", { name: "Undo" })
    )
    expect(
      await page.findByRole("button", { name: "Priority: Normal" })
    ).toBeVisible()
  })
  it("opens the full saved posting URL through a keyboard-focusable source link", async () => {
    const jobUrl = "https://careers.example.org/jobs/123?team=design#apply"
    setMockJobs([mockJob({ id, jobUrl, sourceHost: "careers.example.org" })])
    renderApp(`/apply/${id}`)

    const source = await screen.findByRole("link", {
      name: "careers.example.org",
    })
    expect(source).toHaveAttribute("href", jobUrl)
    expect(source).toHaveAttribute("target", "_blank")
    expect(source).toHaveAttribute("rel", "noopener noreferrer")
    source.focus()
    expect(source).toHaveFocus()
    expect(source.tabIndex).toBe(0)
  })

  it.each(["javascript:alert(1)", "https://jobs.example.com/role", null])(
    "keeps a non-openable posting source as text: %s",
    async (jobUrl) => {
      setMockJobs([mockJob({ id, jobUrl, sourceHost: "Saved source" })])
      renderApp(`/apply/${id}`)

      expect(await screen.findByText("Saved source")).toBeVisible()
      expect(screen.queryByRole("link", { name: "Saved source" })).toBeNull()
    }
  )

  it("keeps an overlong note editable and explains the limit without posting", async () => {
    setMockJobs([
      mockJob({ id, title: "Junior Marketing", company: "Lumière" }),
    ])
    renderApp(`/apply/${id}`)
    const note = await screen.findByRole("textbox", { name: "Leave a note" })
    expect(note.className).toMatch(/\btext-base\b/)
    const prep = screen.getByRole("button", { name: "Interview prep" })
    expect(prep.className).toMatch(/\bmd:h-6\b/)
    expect(prep.className).not.toMatch(/\bmd:h-4\b/)
    const draft = "x".repeat(4001)
    fireEvent.change(note, { target: { value: draft } })
    fireEvent.keyDown(note, { key: "Enter" })

    expect(note).toHaveValue(draft)
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /4,000 characters/i
    )
    expect(
      getMockJobPosts().filter((post) => post.name === "job.addNote")
    ).toHaveLength(0)
  })

  it("submits a 4,000-character note with Enter and leaves Shift+Enter alone", async () => {
    setMockJobs([
      mockJob({ id, title: "Junior Marketing", company: "Lumière" }),
    ])
    renderApp(`/apply/${id}`)
    const note = await screen.findByRole("textbox", { name: "Leave a note" })
    fireEvent.change(note, { target: { value: "x" } })
    expect(fireEvent.keyDown(note, { key: "Enter", shiftKey: true })).toBe(true)
    expect(
      getMockJobPosts().filter((post) => post.name === "job.addNote")
    ).toHaveLength(0)

    const body = "x".repeat(4000)
    fireEvent.change(note, { target: { value: body } })
    fireEvent.keyDown(note, { key: "Enter" })
    await waitFor(() => {
      expect(
        getMockJobPosts().some(
          (post) => post.name === "job.addNote" && post.input.body === body
        )
      ).toBe(true)
    })
    await waitFor(() => expect(note).toHaveValue(""))
  })

  it("keeps a note draft and offers a retry when saving fails", async () => {
    setMockJobs([
      mockJob({ id, title: "Junior Marketing", company: "Lumière" }),
    ])
    rejectNextNote()
    renderApp(`/apply/${id}`)
    const note = await screen.findByRole("textbox", { name: "Leave a note" })
    fireEvent.change(note, {
      target: { value: "Try the hiring manager again." },
    })
    fireEvent.keyDown(note, { key: "Enter" })

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /could not save/i
    )
    expect(note).toHaveValue("Try the hiring manager again.")
    fireEvent.change(note, { target: { value: "Updated draft" } })
    expect(screen.queryByRole("alert")).toBeNull()
    expect(note).toHaveValue("Updated draft")
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
            reversible: false,
          },
          ...[
            ["job.star", "You starred it"],
            ["job.addChecklistItem", 'You added "Call them" to the checklist'],
            ["job.setChecklistItem", "You ticked a checklist item"],
            ["job.linkPaper", "You linked Junior Marketing CV"],
          ].map(([command, summary], index) => ({
            id: `01900000-0000-7000-8000-00000000005${index}`,
            createdAt: "2026-10-27T03:00:00.000Z",
            actor: "person" as const,
            command,
            subjectKind: "job",
            subjectId: id,
            summary,
            undoneAt: null,
            reversible: false,
          })),
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
    renderApp(`/apply/${id}`)
    const crumb = await headerBar()
    expect(
      within(screen.getByRole("navigation", { name: "Breadcrumb" })).getByRole(
        "link",
        { name: "Apply" }
      )
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
    for (const hidden of [
      "You starred it",
      'You added "Call them" to the checklist',
      "You ticked a checklist item",
    ])
      expect(screen.queryByText(hidden)).not.toBeInTheDocument()
    expect(
      screen.getByText("You linked Junior Marketing CV")
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
    expect(
      screen.getByRole("button", { name: "Priority: Normal" })
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Leave a note" }))
    await waitFor(() => {
      expect(
        getMockJobPosts().some(
          (post) =>
            post.name === "job.addNote" &&
            post.input.body === "Bring the checkout study."
        )
      ).toBe(true)
    })
    fireEvent.click(screen.getByRole("button", { name: "Stage: Saved" }))
    fireEvent.click(await screen.findByRole("menuitem", { name: "Closed" }))
    await waitFor(() => {
      expect(
        getMockJobPosts().some(
          (post) => post.name === "job.move" && post.input.stage === "closed"
        )
      ).toBe(true)
    })
    const move = getMockJobPosts().find(
      (post) => post.name === "job.move" && post.input.stage === "closed"
    )
    fireEvent.click(await screen.findByRole("button", { name: "Undo" }))
    await waitFor(() => {
      expect(
        getMockJobPosts().some(
          (post) =>
            post.name === "activity.undo" &&
            post.input.activityId === move?.activityId
        )
      ).toBe(true)
    })
  })

  it("tells the person Undo was skipped when the card moved again", async () => {
    setMockJobs([mockJob({ id, stage: "saved", position: "a0" })])
    refuseNextUndoWith("This card moved again, so Undo was skipped")
    renderApp(`/apply/${id}`)
    await headerBar()
    fireEvent.click(screen.getByRole("button", { name: "Stage: Saved" }))
    fireEvent.click(await screen.findByRole("menuitem", { name: "Closed" }))
    fireEvent.click(await screen.findByRole("button", { name: "Undo" }))
    expect(
      await screen.findByText("This card moved again, so Undo was skipped")
    ).toBeInTheDocument()
  })

  it("shows a message instead of crashing when the link has a bad job id", async () => {
    renderApp("/apply/not-a-job-id")
    expect(await screen.findByText("This job link isn't valid.")).toBeTruthy()
  })

  it("opens the next job with no delete dialog left open after a delete", async () => {
    setMockJobs([
      mockJob({
        id,
        title: "First role",
        company: "Acme",
        stage: "saved",
        position: "a0",
      }),
      mockJob({
        id: other,
        title: "Next role",
        company: "Contoso",
        stage: "saved",
        position: "a1",
      }),
    ])
    renderApp(`/apply/${id}`)
    fireEvent.click(await screen.findByRole("button", { name: "More" }))
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete job" }))
    const dialog = await screen.findByRole("dialog", {
      name: "Delete First role?",
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete job" }))
    expect(
      await screen.findByRole("heading", { name: "Next role" })
    ).toBeTruthy()
    expect(screen.queryByRole("dialog")).toBeNull()
  })
  it("shows the interview in the timezone chosen in Preferences", async () => {
    setMockTimeZone("Asia/Singapore")
    setMockJobs([
      mockJob({
        id,
        title: "Junior Marketing",
        company: "Lumière Cosmetics",
        interviewAt: "2026-10-29T03:00:00.000Z",
      }),
    ])
    renderApp(`/apply/${id}`)
    const interview = await screen.findByRole("button", {
      name: "Interview: Interview Oct 29, 11:00",
    })
    fireEvent.click(interview)
    const field = await screen.findByLabelText("Interview")
    expect(field).toHaveValue("2026-10-29T11:00")
    expect(field.className).toMatch(/\btext-base\b/)
  })
  it("edits a property from its row, adds a prep step, and unlinks a CV", async () => {
    setMockJobs([
      {
        ...mockJob({
          id,
          title: "Junior Marketing",
          company: "Lumière Cosmetics",
          location: "Hanoi",
          interviewAt: "2026-10-29T03:00:00.000Z",
          recruiterName: "Minh Tran",
        }),
        linked: {
          cv: {
            id: parsePaperId("01900000-0000-7000-8000-000000000051"),
            name: "Junior Marketing CV",
          },
          letter: null,
        },
        activity: [
          {
            id: "01900000-0000-7000-8000-000000000052",
            createdAt: "2026-10-21T02:00:00.000Z",
            actor: "person",
            command: "job.addNote",
            subjectKind: "job",
            subjectId: id,
            summary: "Minh likes concrete numbers.",
            undoneAt: null,
            reversible: false,
          },
        ],
      },
    ])
    renderApp(`/apply/${id}`)
    expect(
      await screen.findByRole("button", {
        name: "Interview: Interview Oct 29, 10:00",
      })
    ).toBeInTheDocument()
    expect(screen.getByText("Minh likes concrete numbers.")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Add cover letter" })
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Location: Hanoi" }))
    const location = await screen.findByRole("textbox", { name: "Location" })
    fireEvent.change(location, { target: { value: "Da Nang" } })
    fireEvent.submit(location.closest("form") as HTMLFormElement)
    await waitFor(() => {
      expect(
        getMockJobPosts().some(
          (post) =>
            post.name === "job.update" &&
            (post.input.patch as { location?: string }).location === "Da Nang"
        )
      ).toBe(true)
    })

    fireEvent.click(screen.getByRole("button", { name: "Add a step" }))
    const step = await screen.findByRole("textbox", { name: "Add a step" })
    expect(step.className).toMatch(/\btext-base\b/)
    fireEvent.change(step, { target: { value: "Print the CV" } })
    submitPrepStep(step)
    await waitFor(() => {
      expect(
        getMockJobPosts().some(
          (post) =>
            post.name === "job.addChecklistItem" &&
            post.input.label === "Print the CV"
        )
      ).toBe(true)
    })

    fireEvent.click(
      screen.getByRole("button", { name: "CV: Junior Marketing CV" })
    )
    fireEvent.click(await screen.findByRole("button", { name: "Remove" }))
    await waitFor(() => {
      expect(
        getMockJobPosts().some(
          (post) => post.name === "job.unlinkPaper" && post.input.kind === "cv"
        )
      ).toBe(true)
    })
  })

  it("asks Cancel or Delete job and deletes without a Move to Closed shortcut", async () => {
    setMockJobs([mockJob({ id, title: "First role", company: "Acme" })])
    renderApp(`/apply/${id}`)
    fireEvent.click(await screen.findByRole("button", { name: "More" }))
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete job" }))
    const dialog = await screen.findByRole("dialog", {
      name: "Delete First role?",
    })
    expect(dialog).toHaveAttribute("data-slot", "confirm-delete")
    expect(dialog.className).not.toContain("118px")
    expect(
      document.querySelector("[data-slot='apply-column-anchor']")
    ).not.toBeNull()
    expect(within(dialog).getByText("This can't be undone.")).toBeTruthy()
    expect(
      within(dialog)
        .getAllByRole("button")
        .map((b) => b.textContent)
    ).toEqual(["Cancel", "Delete job"])
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })

  it("copies the job link and hides and shows the properties panel from the header", async () => {
    const writeText = vi.fn(() => Promise.resolve())
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } })
    setMockJobs([mockJob({ id, title: "First role", company: "Acme" })])
    renderApp(`/apply/${id}`)
    const crumb = await headerBar()
    fireEvent.click(within(crumb).getByRole("button", { name: "Copy link" }))
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(window.location.href)
    )
    const panel = within(crumb).getByRole("button", {
      name: "Properties panel",
    })
    expect(panel).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("region", { name: "Properties" })).toBeTruthy()
    fireEvent.click(panel)
    expect(panel).toHaveAttribute("aria-pressed", "false")
    expect(screen.queryByRole("region", { name: "Properties" })).toBeNull()
    vi.unstubAllGlobals()
  })

  it("explains an overlong prep step and keeps the draft", async () => {
    setMockJobs([
      mockJob({ id, title: "Junior Marketing", company: "Lumière Cosmetics" }),
    ])
    renderApp(`/apply/${id}`)

    fireEvent.click(await screen.findByRole("button", { name: "Add a step" }))
    const step = await screen.findByRole("textbox", { name: "Add a step" })
    const draft = "x".repeat(203)
    fireEvent.change(step, { target: { value: draft } })
    submitPrepStep(step)

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "200 characters or fewer"
    )
    expect(step).toHaveValue(draft)
    expect(
      getMockJobPosts().some((post) => post.name === "job.addChecklistItem")
    ).toBe(false)
  })

  it("accepts a 200-character prep step and clears it on success", async () => {
    setMockJobs([
      mockJob({ id, title: "Junior Marketing", company: "Lumière Cosmetics" }),
    ])
    renderApp(`/apply/${id}`)

    fireEvent.click(await screen.findByRole("button", { name: "Add a step" }))
    const step = await screen.findByRole("textbox", { name: "Add a step" })
    const draft = `  ${"x".repeat(200)}  `
    fireEvent.change(step, { target: { value: draft } })
    submitPrepStep(step)

    await waitFor(() => {
      expect(
        getMockJobPosts().some(
          (post) =>
            post.name === "job.addChecklistItem" &&
            post.input.label === "x".repeat(200)
        )
      ).toBe(true)
      expect(step).toHaveValue("")
    })
  })

  it("shows a command failure and lets the prep step be retried", async () => {
    setMockJobs([
      mockJob({ id, title: "Junior Marketing", company: "Lumière Cosmetics" }),
    ])
    renderApp(`/apply/${id}`)

    fireEvent.click(await screen.findByRole("button", { name: "Add a step" }))
    const step = await screen.findByRole("textbox", { name: "Add a step" })
    const draft = "Prepare two examples"
    fireEvent.change(step, { target: { value: draft } })
    rejectNextChecklistItem()
    submitPrepStep(step)

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not add this prep step. Try again."
    )
    expect(step).toHaveValue(draft)
    submitPrepStep(step)
    expect(screen.queryByRole("alert")).toBeNull()
    await waitFor(() => {
      expect(
        getMockJobPosts().some(
          (post) =>
            post.name === "job.addChecklistItem" && post.input.label === draft
        )
      ).toBe(true)
      expect(step).toHaveValue("")
    })
  })
})
