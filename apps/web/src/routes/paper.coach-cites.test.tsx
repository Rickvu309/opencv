import { describe, expect, it, vi } from "vitest"
import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { COACH_FLOAT_NUDGE_ATTR } from "@/features/paper/coach-float.tsx"
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
  stubDesktopViewport,
} from "@/test/paper-route-fixtures.ts"

installPaperTestLifecycle()

describe("Paper Coach cites and mobile sheet", () => {
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

  it("opens a mobile sheet with a backdrop and focus trap", async () => {
    stubDesktopViewport(false)
    renderPaper()
    await expectPaperDrive()
    await openDoc("PM track CV")
    const dialog = await openCoach()

    expect(
      queryByAttr(document, "data-coach-float-backdrop")
    ).toBeInTheDocument()
    expect(dialog).toHaveAttribute("aria-modal", "true")

    const focusable = [
      ...dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ),
    ]
    expect(focusable.length).toBeGreaterThan(1)
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    last?.focus()
    fireEvent.keyDown(dialog, { key: "Tab" })
    expect(first).toHaveFocus()
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true })
    expect(last).toHaveFocus()
  })

  it("auto-minimizes on canvas focus so the CV stays editable, then restores the Thread", async () => {
    scriptCoachStream({ texts: ["Keep the checkout metric."] })
    renderPaper()
    await expectPaperDrive()
    const editor = await openDoc("PM track CV")
    const dialog = await openCoach()

    expect(dialog).not.toHaveAttribute("draggable")
    expect(queryByAttr(dialog, "data-coach-float-resize")).toBeNull()

    const canvas = queryByAttr(editor, "data-paper-canvas")
    expect(canvas).toBeInstanceOf(HTMLElement)
    expect(canvas).toHaveAttribute(COACH_FLOAT_NUDGE_ATTR)

    fireEvent.change(messageCoach(dialog), {
      target: { value: "Sharpen the checkout bullet" },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Send" }))
    expect(
      await within(dialog).findByText("Keep the checkout metric.")
    ).toBeInTheDocument()

    const thread = queryByAttr(dialog, "data-coach-float-thread")
    const viewport = queryByAttr(dialog, "data-coach-thread-viewport")
    expect(thread).toBeInstanceOf(HTMLElement)
    expect(viewport).toBeInstanceOf(HTMLElement)
    if (viewport instanceof HTMLElement) viewport.scrollTop = 48
    const rememberedScroll =
      viewport instanceof HTMLElement ? viewport.scrollTop : 0

    const summary = within(editor).getByRole("textbox", { name: "Summary" })
    fireEvent.pointerDown(summary)
    fireEvent.focusIn(summary)

    const minimized = screen.getByRole("dialog", { name: "Coach" })
    expect(minimized).toHaveAttribute("data-coach-float-state", "minimized")
    expect(localStorage.getItem("opencv:paper:coach-float")).toBe("minimized")
    expect(canvas).not.toHaveAttribute(COACH_FLOAT_NUDGE_ATTR)
    expect(
      screen.queryByRole("textbox", { name: "Message Coach" })
    ).not.toBeInTheDocument()
    expect(queryByAttr(minimized, "data-coach-float-thread")).toBe(thread)

    summary.textContent = "Edited while Coach is tucked away."
    fireEvent.input(summary)
    expect(summary).toHaveTextContent("Edited while Coach is tucked away.")

    fireEvent.click(screen.getByRole("button", { name: "Restore" }))
    const restored = screen.getByRole("dialog", { name: "Coach" })
    expect(restored).toHaveAttribute("data-coach-float-state", "open")
    expect(canvas).toHaveAttribute(COACH_FLOAT_NUDGE_ATTR)
    expect(queryByAttr(restored, "data-coach-float-thread")).toBe(thread)
    expect(
      within(restored).getByText("Keep the checkout metric.")
    ).toBeInTheDocument()
    expect(
      within(restored).getByText("Sharpen the checkout bullet")
    ).toBeInTheDocument()
    if (rememberedScroll > 0) {
      expect(
        queryByAttr(restored, "data-coach-thread-viewport")
      ).toHaveProperty("scrollTop", rememberedScroll)
    }

    fireEvent.keyDown(restored, { key: "Escape" })
    expect(
      screen.queryByRole("dialog", { name: "Coach" })
    ).not.toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Coach" })).toHaveFocus()
    })
  })

  it("does not auto-minimize the mobile sheet on canvas focus", async () => {
    stubDesktopViewport(false)
    renderPaper()
    await expectPaperDrive()
    const editor = await openDoc("PM track CV")
    await openCoach()

    const summary = within(editor).getByRole("textbox", { name: "Summary" })
    fireEvent.pointerDown(summary)
    fireEvent.focusIn(summary)

    expect(screen.getByRole("dialog", { name: "Coach" })).toHaveAttribute(
      "data-coach-float-state",
      "open"
    )
    expect(queryByAttr(editor, "data-paper-canvas")).not.toHaveAttribute(
      COACH_FLOAT_NUDGE_ATTR
    )
  })
})
