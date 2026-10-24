import { describe, expect, it, vi } from "vitest"
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react"
import {
  expectApplyLive,
  installApplyTestLifecycle,
  renderApply,
  stageColumn,
} from "@/test/apply-route-fixtures.ts"

installApplyTestLifecycle()

const COUNT = "[data-slot='number-ticker'] > span:first-child"

describe("Apply filters", () => {
  it("narrows the board to the picked Stage and says where nothing matches", async () => {
    renderApply()
    await expectApplyLive()

    fireEvent.click(screen.getByRole("button", { name: "Filters" }))
    fireEvent.click(await screen.findByRole("checkbox", { name: "Sent" }))

    expect(
      await screen.findByRole("button", { name: /^Filters/, hidden: true })
    ).toHaveTextContent("Filters1")
    expect(
      within(stageColumn("sent")).getByRole("button", {
        name: /Product analyst intern/,
        hidden: true,
      })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", {
        name: /Associate PM intern/,
        hidden: true,
      })
    ).not.toBeInTheDocument()
    expect(
      within(stageColumn("inbox")).getByText("No match in Inbox")
    ).toBeInTheDocument()
  })

  it("keeps only starred cards with the starred switch", async () => {
    renderApply()
    await expectApplyLive()

    fireEvent.click(screen.getByRole("button", { name: "Filters" }))
    fireEvent.click(await screen.findByRole("button", { name: /^Starred/ }))
    fireEvent.click(
      await screen.findByRole("checkbox", { name: "Starred only" })
    )

    await waitFor(() => {
      expect(
        screen.queryByRole("button", {
          name: /Product analyst intern/,
          hidden: true,
        })
      ).not.toBeInTheDocument()
    })
    expect(
      screen.getByRole("button", { name: /Associate PM intern/, hidden: true })
    ).toBeInTheDocument()
  })
})

describe("Apply view and counts", () => {
  it("switches between Board and Calendar with the segmented control", async () => {
    renderApply()
    await expectApplyLive()

    expect(screen.getByRole("radio", { name: "Board" })).toBeChecked()
    fireEvent.click(screen.getByRole("radio", { name: "Calendar" }))

    expect(screen.getByRole("radio", { name: "Calendar" })).toBeChecked()
    expect(document.querySelector("[data-apply-board]")).toBeNull()
  })

  it("shows the Stage counts and the Opportunities total", async () => {
    renderApply()
    await expectApplyLive()

    expect(
      within(stageColumn("inbox")).getByText("2", { selector: COUNT })
    ).toBeInTheDocument()
    expect(
      within(stageColumn("live")).getByText("0", { selector: COUNT })
    ).toBeInTheDocument()
    expect(screen.getByText("5", { selector: COUNT })).toBeInTheDocument()
    expect(
      screen.getByText("Opportunities", { selector: "header p" })
    ).toBeInTheDocument()
  })
})

describe("Apply notices", () => {
  it("offers Clear demo from the notice stack and lets it be dismissed", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    renderApply()
    await expectApplyLive()

    const stack = screen.getByRole("region", { name: "Notifications" })
    expect(
      within(stack).getByRole("button", { name: "Clear demo" })
    ).toBeInTheDocument()

    fireEvent.click(
      within(stack).getByRole("button", { name: "Dismiss Demo Opportunities" })
    )
    act(() => {
      vi.advanceTimersByTime(400)
    })

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Clear demo" })
      ).not.toBeInTheDocument()
    })
  })

  it("asks before clearing the demo cards and keeps your own", async () => {
    renderApply()
    await expectApplyLive()

    fireEvent.click(screen.getByRole("button", { name: "Clear demo" }))
    let dialog = await screen.findByRole("dialog", {
      name: "Remove 4 sample opportunities?",
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }))
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
    expect(
      screen.getByRole("button", { name: /Associate PM intern/ })
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Clear demo" }))
    dialog = await screen.findByRole("dialog")
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove" }))

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /Associate PM intern/ })
      ).not.toBeInTheDocument()
    })
    expect(
      screen.getByRole("button", { name: /Product intern/ })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Clear demo" })
    ).not.toBeInTheDocument()
  })
})

describe("Apply next step", () => {
  it("accepts the recommended move and undoes it", async () => {
    renderApply()
    await expectApplyLive()

    fireEvent.click(screen.getByRole("button", { name: /Product intern/ }))
    const panel = await screen.findByRole("complementary", {
      name: "Opportunity detail",
    })
    fireEvent.click(
      within(panel).getByRole("button", { name: "Accept move to prep" })
    )

    await waitFor(() => {
      expect(
        within(stageColumn("prep")).getByRole("button", {
          name: /Product intern/,
        })
      ).toBeInTheDocument()
    })

    fireEvent.click(within(panel).getByRole("button", { name: "Undo" }))
    await waitFor(() => {
      expect(
        within(stageColumn("inbox")).getByRole("button", {
          name: /Product intern/,
        })
      ).toBeInTheDocument()
    })
  })
})
