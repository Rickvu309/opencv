import { describe, expect, it, vi } from "vitest"
import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { expectPaperDrive } from "@/test/paper-drive.ts"
import {
  getLastCoachRequest,
  scriptCoachStream,
} from "@/test/threads-api-mock.ts"
import {
  queryByAttr,
  installPaperTestLifecycle,
  renderPaper,
  openDoc,
  openCoach,
  messageCoach,
  selectNodeContents,
  collapseWindowSelection,
} from "@/test/paper-route-fixtures.ts"

installPaperTestLifecycle()

describe("Paper Coach cites", () => {
  it("offers one cite that scrolls and highlights the matching Experience bullet", async () => {
    const scrollIntoView = vi.fn()
    const originalScroll = HTMLElement.prototype.scrollIntoView
    HTMLElement.prototype.scrollIntoView = scrollIntoView
    scriptCoachStream({
      texts: [
        "The checkout UX hallway study is thin. Tighten the add-to-cart line so a recruiter can see the 18% lift.",
      ],
    })
    try {
      renderPaper()
      await expectPaperDrive()
      const editor = await openDoc("PM track CV")
      const dialog = await openCoach()

      expect(
        within(dialog).getByRole("status", { name: "In context" })
      ).toHaveTextContent("PM track CV")

      fireEvent.change(messageCoach(dialog), {
        target: {
          value: "What should I change about the checkout UX bullet?",
        },
      })
      fireEvent.click(within(dialog).getByRole("button", { name: "Send" }))
      expect(
        await within(dialog).findByText(
          "The checkout UX hallway study is thin. Tighten the add-to-cart line so a recruiter can see the 18% lift."
        )
      ).toBeInTheDocument()

      const cite = within(dialog).getByRole("button", {
        name: /Show on Paper:.*Checkout UX/,
      })
      expect(cite).toHaveAttribute("data-coach-cite", "experience-1-bullet-1")
      expect(
        within(dialog).getAllByRole("button", { name: /Show on Paper/ })
      ).toHaveLength(1)
      expect(dialog).not.toHaveTextContent(/provenance/i)
      expect(dialog).not.toHaveTextContent(/sources rail/i)
      expect(
        within(dialog).queryByRole("complementary", { name: /sources/i })
      ).not.toBeInTheDocument()

      fireEvent.click(cite)
      const bullet = queryByAttr(
        editor,
        'data-paper-section="experience-1-bullet-1"'
      )
      expect(bullet).toHaveClass("paper-coach-changed")
      expect(scrollIntoView).toHaveBeenCalledWith(
        expect.objectContaining({ block: "center" })
      )
      expect(
        within(dialog).getByRole("status", { name: "In context" })
      ).toBeInTheDocument()
    } finally {
      HTMLElement.prototype.scrollIntoView = originalScroll
    }
  })

  it("cites a durable selection chip when the reply is generic", async () => {
    scriptCoachStream({ texts: ["I read that bullet."] })
    renderPaper()
    await expectPaperDrive()
    const editor = await openDoc("PM track CV")
    const dialog = await openCoach()
    const bullet = within(editor).getAllByRole("textbox", {
      name: "Bullet point",
    })[0]
    const bulletText = bullet!.textContent ?? ""
    selectNodeContents(bullet!)
    messageCoach(dialog).focus()
    collapseWindowSelection()

    fireEvent.click(
      within(
        await within(dialog).findByRole("status", { name: "Selected text" })
      ).getByRole("button", { name: "Add to context" })
    )
    expect(
      within(dialog).getByRole("status", { name: "Selection in context" })
    ).toBeInTheDocument()

    fireEvent.change(messageCoach(dialog), {
      target: { value: "What is weak about this bullet?" },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Send" }))
    expect(
      await within(dialog).findByText("I read that bullet.")
    ).toBeInTheDocument()

    const cite = within(dialog).getByRole("button", { name: /Show on Paper/ })
    expect(cite).toHaveAttribute(
      "data-coach-cite",
      expect.stringMatching(/^experience-0-bullet-0$/)
    )
    expect(getLastCoachRequest()?.selection?.text).toBe(bulletText)
    expect(
      within(dialog).getByRole("status", { name: "In context" })
    ).toBeInTheDocument()
  })

  it("keeps a chip-grounded cite after the next Coach turn", async () => {
    scriptCoachStream({ texts: ["I read that bullet."] })
    renderPaper()
    await expectPaperDrive()
    const editor = await openDoc("PM track CV")
    const dialog = await openCoach()
    const bullet = within(editor).getAllByRole("textbox", {
      name: "Bullet point",
    })[0]
    selectNodeContents(bullet!)
    messageCoach(dialog).focus()
    collapseWindowSelection()

    fireEvent.click(
      within(
        await within(dialog).findByRole("status", { name: "Selected text" })
      ).getByRole("button", { name: "Add to context" })
    )
    const chip = within(dialog).getByRole("status", {
      name: "Selection in context",
    })
    fireEvent.click(
      within(chip).getByRole("button", { name: "Pin in context" })
    )
    expect(chip).toHaveAttribute("data-pinned", "true")

    fireEvent.change(messageCoach(dialog), {
      target: { value: "What is weak about this bullet?" },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Send" }))
    expect(
      await within(dialog).findByText("I read that bullet.")
    ).toBeInTheDocument()
    expect(
      within(dialog).getByRole("button", { name: /Show on Paper/ })
    ).toHaveAttribute("data-coach-cite", "experience-0-bullet-0")

    scriptCoachStream({ texts: ["Say more?"] })
    fireEvent.change(messageCoach(dialog), {
      target: { value: "And the next line?" },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Send" }))
    expect(await within(dialog).findByText("Say more?")).toBeInTheDocument()
    expect(within(dialog).getByText("I read that bullet.")).toBeInTheDocument()

    const cites = within(dialog).getAllByRole("button", {
      name: /Show on Paper/,
    })
    expect(
      cites.some(
        (button) =>
          button.getAttribute("data-coach-cite") === "experience-0-bullet-0"
      )
    ).toBe(true)
    expect(
      within(dialog).getByRole("status", { name: "Selection in context" })
    ).toHaveAttribute("data-pinned", "true")
  })

  it("does not invent a cite or sources rail for generic advice", async () => {
    scriptCoachStream({
      texts: [
        "Write one Proof with a concrete outcome. That is the next step.",
      ],
    })
    renderPaper()
    await expectPaperDrive()
    await openDoc("PM track CV")
    const dialog = await openCoach()
    fireEvent.change(messageCoach(dialog), {
      target: { value: "What should I do this week?" },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Send" }))
    expect(
      await within(dialog).findByText(
        "Write one Proof with a concrete outcome. That is the next step."
      )
    ).toBeInTheDocument()
    expect(
      within(dialog).queryByRole("button", { name: /Show on Paper/ })
    ).not.toBeInTheDocument()
    expect(queryByAttr(dialog, "data-coach-cite")).toBeNull()
    expect(dialog).not.toHaveTextContent(/provenance/i)
    expect(
      within(dialog).queryByRole("complementary", { name: /sources/i })
    ).not.toBeInTheDocument()
  })

  it("closes the float on Escape and returns focus to the pill", async () => {
    renderPaper()
    await expectPaperDrive()
    await openDoc("PM track CV")

    const pill = screen.getByRole("button", { name: "Coach" })
    pill.focus()
    fireEvent.click(pill)
    const dialog = await screen.findByRole("dialog", { name: "Coach" })
    fireEvent.keyDown(dialog, { key: "Escape" })

    expect(
      screen.queryByRole("dialog", { name: "Coach" })
    ).not.toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Coach" })).toHaveFocus()
    })
  })

  it("keeps the docked Coach and its Thread while the CV is edited", async () => {
    scriptCoachStream({ texts: ["Keep the checkout metric."] })
    renderPaper()
    await expectPaperDrive()
    const editor = await openDoc("PM track CV")
    const dialog = await openCoach()

    expect(dialog).not.toHaveAttribute("draggable")
    expect(queryByAttr(dialog, "data-coach-float-resize")).toBeNull()
    expect(editor).toContainElement(dialog)

    fireEvent.change(messageCoach(dialog), {
      target: { value: "Sharpen the checkout bullet" },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Send" }))
    expect(
      await within(dialog).findByText("Keep the checkout metric.")
    ).toBeInTheDocument()

    const summary = within(editor).getByRole("textbox", { name: "Summary" })
    fireEvent.pointerDown(summary)
    fireEvent.focusIn(summary)
    summary.textContent = "Edited beside the Coach."
    fireEvent.input(summary)

    expect(screen.getByRole("dialog", { name: "Coach" })).toHaveAttribute(
      "data-coach-float-state",
      "open"
    )
    expect(summary).toHaveTextContent("Edited beside the Coach.")
    expect(
      within(dialog).getByText("Keep the checkout metric.")
    ).toBeInTheDocument()
    expect(
      within(dialog).getByText("Sharpen the checkout bullet")
    ).toBeInTheDocument()

    fireEvent.keyDown(dialog, { key: "Escape" })
    expect(
      screen.queryByRole("dialog", { name: "Coach" })
    ).not.toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Coach" })).toHaveFocus()
    })
  })
})
