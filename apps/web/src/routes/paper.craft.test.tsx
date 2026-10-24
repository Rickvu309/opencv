import { afterEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react"
import { STARTER_CV_NAME } from "@workspace/domain"
import { paperQueryKeys } from "@/features/paper/paper-api.ts"
import {
  getMockPaperDocs,
  holdPaperList,
  patchMockPaperDoc,
} from "@/test/paper-api-mock.ts"
import { expectPaperDrive } from "@/test/paper-drive.ts"
import {
  installPaperTestLifecycle,
  messageCoach,
  openCoach,
  openDoc,
  renderPaper,
  seedStarterPaperDrive,
} from "@/test/paper-route-fixtures.ts"

installPaperTestLifecycle()

const PM_CV_ID = "11111111-1111-7111-8111-111111111111"

function coachWrites(
  queryClient: ReturnType<typeof renderPaper>["queryClient"]
) {
  const docs = queryClient.getQueryData(paperQueryKeys.list()) as Array<{
    id: string
    content: { summary?: string }
  }>
  const next = docs.map((doc) =>
    doc.id === PM_CV_ID
      ? {
          ...doc,
          updatedAt: "2026-08-26T15:00:00.000Z",
          content: { ...doc.content, summary: "Coach version of the summary" },
        }
      : doc
  )
  patchMockPaperDoc(PM_CV_ID, {
    content: next.find((doc) => doc.id === PM_CV_ID)?.content,
    updatedAt: "2026-08-26T15:00:00.000Z",
  })
  act(() => {
    queryClient.setQueryData(paperQueryKeys.list(), next)
  })
}

describe("Paper drive", () => {
  it("leads with the table and offers a button only for the kinds that are missing", async () => {
    seedStarterPaperDrive()
    renderPaper()
    expect(await screen.findByText(STARTER_CV_NAME)).toBeInTheDocument()

    expect(
      screen.queryByRole("region", { name: "CVs" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("region", { name: "Linked to Apply" })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Start a Letter" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Add a Proof" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Start a CV" })
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Start a Letter" }))
    expect(
      await screen.findByRole("region", { name: "Editing Untitled Letter" })
    ).toBeInTheDocument()
  })

  it("shows no prompts once a CV, a Letter and a Proof exist", async () => {
    renderPaper()
    await expectPaperDrive()
    expect(
      screen.queryByRole("button", { name: "Start a Letter" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Add a Proof" })
    ).not.toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Letters" })).toBeNull()
  })

  it("has no Filter control until there is something to filter by", async () => {
    renderPaper()
    await expectPaperDrive()
    expect(
      screen.queryByRole("button", { name: /filter/i })
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument()
  })

  it("shows skeleton rows and its own loading sentence while the list loads", async () => {
    const release = holdPaperList()
    renderPaper()
    expect(await screen.findByText(/^Loading documents/)).toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
    expect(screen.queryByText(/^No documents yet/)).not.toBeInTheDocument()
    expect(
      document.querySelectorAll("[data-slot='shimmer-skeleton']").length
    ).toBeGreaterThan(0)
    release()
    await expectPaperDrive()
  })
})

describe("Paper CV name", () => {
  it("opens the sample CV with an empty field labelled Your name", async () => {
    seedStarterPaperDrive()
    renderPaper()
    const editor = await openDoc(STARTER_CV_NAME)
    const name = within(editor).getByRole("textbox", { name: "Your name" })
    expect(name).toHaveTextContent("")
    expect(within(editor).queryByText("Your name")).not.toBeInTheDocument()
  })
})

describe("Paper Coach dock", () => {
  it("docks the Coach inside the editor and keeps it open while the CV is edited", async () => {
    renderPaper()
    await expectPaperDrive()
    const editor = await openDoc("PM track CV")
    const dialog = await openCoach()

    expect(editor).toContainElement(dialog)
    expect(messageCoach(dialog)).toHaveAttribute("placeholder", "Ask the Coach")

    const summary = within(editor).getByRole("textbox", { name: "Summary" })
    fireEvent.pointerDown(summary)
    fireEvent.focusIn(summary)
    expect(screen.getByRole("dialog", { name: "Coach" })).toHaveAttribute(
      "data-coach-float-state",
      "open"
    )
    expect(messageCoach(dialog)).toBeVisible()
  })
})

describe("Paper list beside the docked Coach", () => {
  it("gives the width to the CV while the Coach is open and still lets the person open the list", async () => {
    renderPaper()
    await expectPaperDrive()
    const editor = await openDoc("PM track CV")
    expect(
      screen.getByRole("complementary", { name: "Paper list" })
    ).toBeInTheDocument()

    await openCoach()
    expect(
      screen.queryByRole("complementary", { name: "Paper list" })
    ).not.toBeInTheDocument()

    fireEvent.click(within(editor).getByRole("button", { name: "Paper list" }))
    expect(
      screen.getByRole("complementary", { name: "Paper list" })
    ).toBeInTheDocument()

    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Coach" })).getByRole(
        "button",
        {
          name: "Close",
        }
      )
    )
    expect(
      screen.getByRole("complementary", { name: "Paper list" })
    ).toBeInTheDocument()
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe("Paper Coach suggestions", () => {
  it("treats the person's own edit as accepting the suggestion", async () => {
    const { queryClient } = renderPaper()
    await expectPaperDrive()
    const editor = await openDoc("PM track CV")
    coachWrites(queryClient)
    await within(editor).findByRole("status", { name: "Coach suggestion" })

    const summary = within(editor).getByRole("textbox", { name: "Summary" })
    summary.textContent = "Mine now"
    fireEvent.input(summary)
    await waitFor(() => {
      expect(
        within(editor).queryByRole("status", { name: "Coach suggestion" })
      ).not.toBeInTheDocument()
    })
    expect(summary).toHaveTextContent("Mine now")
  })

  function serverSummary() {
    const doc = getMockPaperDocs().find((d) => d.id === PM_CV_ID)
    return (doc?.content as { summary: string }).summary
  }

  it("marks a Coach edit until it is kept or undone, and Undo writes the earlier text back to the server", async () => {
    const original = serverSummary()
    const { queryClient } = renderPaper()
    await expectPaperDrive()
    const editor = await openDoc("PM track CV")
    const summary = within(editor).getByRole("textbox", { name: "Summary" })
    expect(summary).toHaveTextContent(original)
    vi.useFakeTimers({ shouldAdvanceTime: true })

    coachWrites(queryClient)
    expect(serverSummary()).toBe("Coach version of the summary")
    await waitFor(() => {
      expect(summary).toHaveTextContent("Coach version of the summary")
    })
    const bar = within(editor).getByRole("status", { name: "Coach suggestion" })
    expect(bar).toHaveTextContent("Coach changed Summary.")
    expect(within(bar).getByRole("button", { name: "Keep" })).toBeEnabled()
    expect(summary).toHaveClass("paper-coach-suggested")
    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(summary).toHaveClass("paper-coach-suggested")

    fireEvent.click(
      within(bar).getByRole("button", { name: "Undo this change" })
    )
    await waitFor(() => {
      expect(summary).toHaveTextContent(original)
    })
    expect(summary).not.toHaveClass("paper-coach-suggested")
    expect(
      within(editor).queryByRole("status", { name: "Coach suggestion" })
    ).not.toBeInTheDocument()
    await waitFor(() => {
      expect(serverSummary()).toBe(original)
    })
    const listed = (await (await fetch("/api/paper")).json()) as {
      data: Array<{ id: string; content: { summary: string } }>
    }
    expect(listed.data.find((d) => d.id === PM_CV_ID)?.content.summary).toBe(
      original
    )
  })

  it("Keep leaves the Coach text and clears the mark", async () => {
    const { queryClient } = renderPaper()
    await expectPaperDrive()
    const editor = await openDoc("PM track CV")
    coachWrites(queryClient)
    const bar = await within(editor).findByRole("status", {
      name: "Coach suggestion",
    })
    fireEvent.click(within(bar).getByRole("button", { name: "Keep" }))
    expect(
      within(editor).queryByRole("status", { name: "Coach suggestion" })
    ).not.toBeInTheDocument()
    const summary = within(editor).getByRole("textbox", { name: "Summary" })
    expect(summary).toHaveTextContent("Coach version of the summary")
    expect(summary).not.toHaveClass("paper-coach-suggested")
    expect(serverSummary()).toBe("Coach version of the summary")
  })

  it("names the document kind in the conflict banner", async () => {
    const { queryClient } = renderPaper()
    await expectPaperDrive()
    const editor = await openDoc("PM track CV")
    const summary = within(editor).getByRole("textbox", { name: "Summary" })
    summary.textContent = "My local edit"
    fireEvent.input(summary)
    patchMockPaperDoc(PM_CV_ID, {})
    coachWrites(queryClient)
    expect(await within(editor).findByRole("alert")).toHaveTextContent(
      "Coach updated this CV while you have unsaved edits."
    )
  })
})
