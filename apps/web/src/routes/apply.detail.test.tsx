import { describe, expect, it, vi } from "vitest"
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react"
import {
  APPLY_DEMO_HINT,
  APPLY_DEMO_LABEL,
} from "@/features/apply/apply-job-structure.ts"
import {
  installApplyTestLifecycle,
  renderApply,
  expectApplyLive,
  addJobFromDialog,
} from "@/test/apply-route-fixtures.ts"

installApplyTestLifecycle()

describe("Apply job detail", () => {
  it("creates a job and links a Paper doc from job detail", async () => {
    renderApply()
    await expectApplyLive()

    await addJobFromDialog()
    const panel = await screen.findByRole("complementary", {
      name: "Job detail",
    })
    expect(within(panel).getByDisplayValue("Untitled role")).toBeInTheDocument()
    expect(
      within(panel).queryByRole("link", { name: "Open job posting" })
    ).not.toBeInTheDocument()
    expect(
      within(panel).queryByRole("button", { name: "Open job posting" })
    ).not.toBeInTheDocument()

    fireEvent.click(
      within(panel).getByRole("button", { name: "Link Paper docs" })
    )
    const menu = await screen.findByRole("menu", { name: "Link Paper docs" })
    fireEvent.click(
      within(menu).getByRole("menuitemcheckbox", { name: /PM track CV/ })
    )
    expect(
      await within(menu).findByRole("menuitemcheckbox", { name: /PM track CV/ })
    ).toHaveAttribute("aria-checked", "true")
    expect(
      await within(panel).findByRole("region", { name: "Linked Paper" })
    ).toHaveTextContent("PM track CV")
  })

  it("adds a job with a posting URL and opens it from the drawer", async () => {
    const open = vi.fn(() => ({ closed: false }))
    vi.stubGlobal("open", open)

    renderApply()
    await expectApplyLive()

    await addJobFromDialog("careers.example.com/pm-intern")
    const panel = await screen.findByRole("complementary", {
      name: "Job detail",
    })
    expect(within(panel).getByDisplayValue("Untitled role")).toBeInTheDocument()
    expect(
      within(panel).getByDisplayValue("https://careers.example.com/pm-intern")
    ).toBeInTheDocument()

    const posting = within(panel).getByRole("link", {
      name: "Open job posting",
    })
    expect(posting).toHaveAttribute(
      "href",
      "https://careers.example.com/pm-intern"
    )
    expect(posting).toHaveAttribute("target", "_blank")
    expect(posting).toHaveAttribute("rel", "noopener noreferrer")
    fireEvent.click(posting)
    expect(open).not.toHaveBeenCalled()
    expect(within(panel).queryByRole("alert")).not.toBeInTheDocument()
    expect(
      screen.queryByText(/browser blocked opening this posting/i)
    ).not.toBeInTheDocument()
  })

  it("keeps Add job open when the posting URL is not a web URL", async () => {
    renderApply()
    await expectApplyLive()

    await addJobFromDialog("javascript:alert(1)")
    const dialog = await screen.findByRole("dialog", { name: "Add job" })
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "That posting link isn't a valid web URL."
    )
    expect(
      screen.queryByRole("complementary", { name: "Job detail" })
    ).not.toBeInTheDocument()
    expect(screen.queryByText("Untitled role")).not.toBeInTheDocument()
  })

  it("keeps an empty Source calm and saves source plus next step", async () => {
    renderApply()
    await expectApplyLive()

    await addJobFromDialog()
    const panel = await screen.findByRole("complementary", {
      name: "Job detail",
    })
    const source = within(panel).getByRole("region", { name: "Source" })
    const nextStep = within(panel).getByRole("region", { name: "Next step" })

    const sourceField = within(source).getByRole("textbox", { name: "Source" })
    const nextStepKind = within(nextStep).getByRole("combobox", {
      name: "Next step",
    })
    expect(sourceField).toHaveValue("")
    expect(within(panel).queryByText(APPLY_DEMO_HINT)).not.toBeInTheDocument()
    expect(
      within(source).getByPlaceholderText("Paste a posting link")
    ).toBeInTheDocument()
    expect(
      within(source).queryByText(/stay organized/i)
    ).not.toBeInTheDocument()
    expect(within(source).queryByText(/never miss/i)).not.toBeInTheDocument()
    expect(within(source).queryByText(/add a source/i)).not.toBeInTheDocument()
    expect(source.querySelector("[data-slot='empty']")).toBeNull()
    expect(nextStepKind).toHaveTextContent("Follow-up")
    expect(within(nextStep).getByLabelText("Date")).toBeInTheDocument()

    fireEvent.change(sourceField, {
      target: { value: "careers.example.com/cafe-role" },
    })
    fireEvent.blur(sourceField)
    await waitFor(() => {
      expect(
        within(panel).getByRole("textbox", { name: "Source" })
      ).toHaveValue("https://careers.example.com/cafe-role")
    })
    expect(within(panel).getByText("careers.example.com")).toBeInTheDocument()
    expect(
      within(panel).getByRole("link", { name: "Open job posting" })
    ).toHaveAttribute("href", "https://careers.example.com/cafe-role")

    fireEvent.change(within(panel).getByLabelText("Date"), {
      target: { value: "2026-09-20" },
    })
    await waitFor(() => {
      expect(within(panel).getByLabelText("Date")).toHaveValue("2026-09-20")
    })

    fireEvent.click(within(panel).getByRole("button", { name: "Close panel" }))
    fireEvent.click(
      screen.getByRole("button", { name: /Untitled role at Company/ })
    )
    const reopened = await screen.findByRole("complementary", {
      name: "Job detail",
    })
    expect(
      within(reopened).getByRole("textbox", { name: "Source" })
    ).toHaveValue("https://careers.example.com/cafe-role")
    expect(within(reopened).getByLabelText("Date")).toHaveValue("2026-09-20")
    expect(
      within(reopened).getByRole("combobox", { name: "Next step" })
    ).toHaveTextContent("Follow-up")
  })

  it("copies the posting link when a new tab is not the path", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText },
    })

    renderApply()
    await expectApplyLive()

    await addJobFromDialog("linkedin.com/jobs/view/123")
    const panel = await screen.findByRole("complementary", {
      name: "Job detail",
    })
    fireEvent.click(within(panel).getByRole("button", { name: "Copy link" }))
    expect(
      await within(panel).findByRole("button", { name: "Copied" })
    ).toBeInTheDocument()
    expect(await within(panel).findByRole("status")).toHaveTextContent(
      "Posting link copied."
    )
    expect(writeText).toHaveBeenCalledWith("https://linkedin.com/jobs/view/123")
    expect(
      screen.queryByText(/browser blocked opening this posting/i)
    ).not.toBeInTheDocument()
  })

  it("shows Copied after Copy link and clears it after 2 seconds", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } })

    renderApply()
    await expectApplyLive()
    await addJobFromDialog("linkedin.com/jobs/view/123")
    const panel = await screen.findByRole("complementary", {
      name: "Job detail",
    })

    vi.useFakeTimers()
    fireEvent.click(within(panel).getByRole("button", { name: "Copy link" }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(writeText).toHaveBeenCalledWith("https://linkedin.com/jobs/view/123")
    expect(
      within(panel).getByRole("button", { name: "Copied" })
    ).toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1999)
    })
    expect(
      within(panel).getByRole("button", { name: "Copied" })
    ).toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(
      within(panel).queryByRole("button", { name: "Copied" })
    ).not.toBeInTheDocument()
    expect(
      within(panel).getByRole("button", { name: "Copy link" })
    ).toBeInTheDocument()
  })

  it("honest-fails copy without claiming the link left", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    })

    renderApply()
    await expectApplyLive()

    await addJobFromDialog("linkedin.com/jobs/view/123")
    const panel = await screen.findByRole("complementary", {
      name: "Job detail",
    })
    fireEvent.click(within(panel).getByRole("button", { name: "Copy link" }))
    expect(await within(panel).findByRole("alert")).toHaveTextContent(
      "Couldn't copy the posting link. Select Source and copy it."
    )
    expect(
      within(panel).getByRole("button", { name: "Copy link" })
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/browser blocked opening this posting/i)
    ).not.toBeInTheDocument()
  })

  it("does not open leftover seeded jobs.example.com", async () => {
    const open = vi.fn(() => ({ closed: false }))
    vi.stubGlobal("open", open)

    renderApply()
    await expectApplyLive()

    fireEvent.click(screen.getByRole("button", { name: /Associate PM intern/ }))
    const panel = await screen.findByRole("complementary", {
      name: "Job detail",
    })
    expect(
      within(panel).queryByRole("link", { name: "Open job posting" })
    ).not.toBeInTheDocument()
    expect(
      within(panel).queryByRole("button", { name: "Open job posting" })
    ).not.toBeInTheDocument()
    expect(within(panel).queryByDisplayValue(/jobs\.example\.com/i)).toBeNull()
    expect(within(panel).getByText(APPLY_DEMO_LABEL)).toBeInTheDocument()
    expect(within(panel).getByText(APPLY_DEMO_HINT)).toBeInTheDocument()
    expect(open).not.toHaveBeenCalled()
  })
})
