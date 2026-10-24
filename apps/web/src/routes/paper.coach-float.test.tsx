import { describe, expect, it } from "vitest"
import { cleanup, fireEvent, screen, within } from "@testing-library/react"
import { SURFACE_PATHS } from "@/features/app-shell/surfaces.ts"
import { expectPaperDrive } from "@/test/paper-drive.ts"
import {
  getLastCoachRequest,
  scriptCoachStream,
} from "@/test/threads-api-mock.ts"
import {
  byAttr,
  installPaperTestLifecycle,
  renderPaper,
  openDoc,
  coachDialog,
  openCoach,
  messageCoach,
  selectNodeContents,
  collapseWindowSelection,
} from "./paper.fixtures.ts"

installPaperTestLifecycle()

describe("Paper Coach float", () => {
  it("uses the shared Coach dock — no AI assist popover or mode picker", async () => {
    renderPaper()
    await expectPaperDrive()
    await openDoc("PM track CV")

    expect(
      screen.queryByRole("button", { name: /AI assist/ })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("dialog", { name: "AI assist" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("dialog", { name: "Coach" })
    ).not.toBeInTheDocument()

    const dialog = await openCoach()
    expect(messageCoach(dialog)).toBeInTheDocument()
    expect(
      within(dialog).queryByRole("button", { name: "Coach mode" })
    ).not.toBeInTheDocument()
    expect(
      within(dialog).queryByRole("radiogroup", { name: "Coach mode" })
    ).not.toBeInTheDocument()
    expect(
      within(dialog).getByRole("button", {
        name: "Sharpen my checkout project bullet",
      })
    ).toBeInTheDocument()
    expect(
      within(dialog).queryByRole("log", { name: "Thread" })
    ).not.toBeInTheDocument()
  })

  it("opens the Coach float without shrinking the canvas scroll area", async () => {
    renderPaper()
    await expectPaperDrive()
    const editor = await openDoc("PM track CV")
    const canvas = byAttr(editor, "data-paper-canvas")
    expect(canvas).toBeInstanceOf(HTMLElement)
    Object.defineProperty(canvas, "clientHeight", {
      configurable: true,
      value: 640,
    })
    expect((canvas as HTMLElement).clientHeight).toBe(640)

    const dialog = await openCoach()
    expect((canvas as HTMLElement).clientHeight).toBe(640)
    expect(editor.contains(dialog)).toBe(false)
  })

  it("cycles pill, open, minimize, and close and persists the float state", async () => {
    renderPaper()
    await expectPaperDrive()
    await openDoc("PM track CV")

    expect(screen.getByRole("button", { name: "Coach" })).toBeInTheDocument()
    expect(localStorage.getItem("opencv:paper:coach-float")).toBe("closed")

    const dialog = await openCoach()
    expect(localStorage.getItem("opencv:paper:coach-float")).toBe("open")
    expect(messageCoach(dialog)).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole("button", { name: "Minimize" }))
    expect(localStorage.getItem("opencv:paper:coach-float")).toBe("minimized")
    expect(screen.getByRole("dialog", { name: "Coach" })).toHaveAttribute(
      "data-coach-float-state",
      "minimized"
    )
    expect(
      screen.queryByRole("textbox", { name: "Message Coach" })
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Restore" }))
    expect(localStorage.getItem("opencv:paper:coach-float")).toBe("open")
    expect(messageCoach()).toBeInTheDocument()

    fireEvent.click(
      within(coachDialog()).getByRole("button", { name: "Close" })
    )
    expect(
      screen.queryByRole("dialog", { name: "Coach" })
    ).not.toBeInTheDocument()
    expect(localStorage.getItem("opencv:paper:coach-float")).toBe("closed")
    expect(screen.getByRole("button", { name: "Coach" })).toBeInTheDocument()

    cleanup()
    renderPaper()
    await expectPaperDrive()
    await openDoc("PM track CV")
    expect(screen.getByRole("button", { name: "Coach" })).toBeInTheDocument()
    expect(
      screen.queryByRole("dialog", { name: "Coach" })
    ).not.toBeInTheDocument()

    localStorage.setItem("opencv:paper:coach-float", "minimized")
    cleanup()
    renderPaper()
    await expectPaperDrive()
    await openDoc("PM track CV")
    expect(
      await screen.findByRole("dialog", { name: "Coach" })
    ).toHaveAttribute("data-coach-float-state", "minimized")
  })

  it("shows a removable soft-scope chip for the open Paper CV", async () => {
    scriptCoachStream({ texts: ["I can still help without the CV."] })
    renderPaper()
    await expectPaperDrive()
    await openDoc("PM track CV")
    const dialog = await openCoach()

    const chip = within(dialog).getByRole("status", { name: "In context" })
    expect(chip).toHaveTextContent("PM track CV")
    expect(chip).toHaveAttribute("data-coach-soft-scope")
    expect(dialog).not.toHaveTextContent(/knowledge.?base/i)
    expect(dialog).not.toHaveTextContent(/add sources/i)
    expect(
      within(dialog).queryByRole("button", { name: /sources library/i })
    ).not.toBeInTheDocument()
    expect(
      within(dialog).queryByRole("complementary", { name: /sources/i })
    ).not.toBeInTheDocument()

    fireEvent.click(
      within(chip).getByRole("button", { name: "Remove from context" })
    )
    expect(
      within(dialog).queryByRole("status", { name: "In context" })
    ).not.toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole("button", { name: "Minimize" }))
    fireEvent.click(screen.getByRole("button", { name: "Restore" }))
    const restored = coachDialog()
    expect(
      within(restored).queryByRole("status", { name: "In context" })
    ).not.toBeInTheDocument()

    fireEvent.change(messageCoach(restored), {
      target: { value: "What should I cut?" },
    })
    fireEvent.click(within(restored).getByRole("button", { name: "Send" }))
    expect(
      await within(restored).findByText("I can still help without the CV.")
    ).toBeInTheDocument()
    expect(getLastCoachRequest()?.text).toBe("What should I cut?")
    expect(getLastCoachRequest()?.focusDocId).toBeUndefined()
  })

  it("adds a durable selection chip that survives Clear and can be removed", async () => {
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

    const preview = await within(dialog).findByRole("status", {
      name: "Selected text",
    })
    fireEvent.click(
      within(preview).getByRole("button", { name: "Add to context" })
    )
    const chip = within(dialog).getByRole("status", {
      name: "Selection in context",
    })
    expect(chip).toHaveTextContent(bulletText.slice(0, 24))
    expect(chip).toHaveAttribute("data-coach-context-chip")
    expect(chip).toHaveAttribute("data-kind", "selection")
    expect(chip).toHaveAttribute("data-pinned", "false")
    expect(
      within(preview).getByRole("button", { name: "Add to context" })
    ).toBeDisabled()
    expect(
      within(preview).getByRole("button", { name: "Add to context" })
    ).toHaveTextContent("Added")
    expect(dialog).not.toHaveTextContent(/knowledge.?base/i)
    expect(dialog).not.toHaveTextContent(/sources library/i)

    fireEvent.click(
      within(preview).getByRole("button", { name: "Clear selection" })
    )
    expect(
      within(dialog).queryByRole("status", { name: "Selected text" })
    ).not.toBeInTheDocument()
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
    expect(getLastCoachRequest()?.selection?.text).toBe(bulletText)
    expect(
      within(dialog).queryByRole("status", { name: "Selection in context" })
    ).not.toBeInTheDocument()

    scriptCoachStream({ texts: ["Say more?"] })
    fireEvent.change(messageCoach(dialog), {
      target: { value: "And the next line?" },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Send" }))
    expect(await within(dialog).findByText("Say more?")).toBeInTheDocument()
    expect(getLastCoachRequest()?.selection).toBeUndefined()
  })

  it("pins a selection chip so it stays across turns until unpin", async () => {
    scriptCoachStream({ texts: ["Pinned, first turn."] })
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
    const chip = within(dialog).getByRole("status", {
      name: "Selection in context",
    })
    fireEvent.click(
      within(chip).getByRole("button", { name: "Pin in context" })
    )
    expect(chip).toHaveAttribute("data-pinned", "true")
    expect(within(chip).getByRole("button", { name: "Unpin" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )

    fireEvent.change(messageCoach(dialog), {
      target: { value: "Keep this bullet in mind" },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Send" }))
    expect(
      await within(dialog).findByText("Pinned, first turn.")
    ).toBeInTheDocument()
    expect(getLastCoachRequest()?.selection?.text).toBe(bulletText)
    const sticky = within(dialog).getByRole("status", {
      name: "Selection in context",
    })
    expect(sticky).toHaveAttribute("data-pinned", "true")

    scriptCoachStream({ texts: ["Pinned, second turn."] })
    fireEvent.change(messageCoach(dialog), {
      target: { value: "Still that bullet?" },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Send" }))
    expect(
      await within(dialog).findByText("Pinned, second turn.")
    ).toBeInTheDocument()
    expect(getLastCoachRequest()?.selection?.text).toBe(bulletText)

    const leftover = within(dialog).getByRole("status", {
      name: "Selection in context",
    })
    fireEvent.click(within(leftover).getByRole("button", { name: "Unpin" }))
    expect(leftover).toHaveAttribute("data-pinned", "false")
    fireEvent.click(
      within(leftover).getByRole("button", { name: "Remove from context" })
    )
    expect(
      within(dialog).queryByRole("status", { name: "Selection in context" })
    ).not.toBeInTheDocument()
  })

  it("attaches the open Paper doc as a visible chip that can coexist with soft-scope", async () => {
    scriptCoachStream({ texts: ["I have the CV attached."] })
    const { router } = renderPaper()
    await expectPaperDrive()
    await openDoc("PM track CV")
    const dialog = await openCoach()

    expect(
      within(dialog).getByRole("status", { name: "In context" })
    ).toHaveTextContent("PM track CV")

    fireEvent.click(within(dialog).getByRole("button", { name: "Add" }))
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Attach from Paper" })
    )
    expect(router.state.location.pathname).toBe(SURFACE_PATHS.paper)
    const attached = within(dialog).getByRole("status", {
      name: "Attached from Paper",
    })
    expect(attached).toHaveTextContent("PM track CV")
    expect(attached).toHaveAttribute("data-kind", "doc")
    expect(
      within(dialog).getByRole("status", { name: "In context" })
    ).toBeInTheDocument()
    expect(dialog).not.toHaveTextContent(/knowledge.?base/i)
    expect(dialog).not.toHaveTextContent(/add sources/i)
    expect(
      within(dialog).queryByRole("complementary", { name: /sources/i })
    ).not.toBeInTheDocument()

    fireEvent.click(
      within(
        within(dialog).getByRole("status", { name: "In context" })
      ).getByRole("button", { name: "Remove from context" })
    )
    expect(
      within(dialog).queryByRole("status", { name: "In context" })
    ).not.toBeInTheDocument()
    expect(
      within(dialog).getByRole("status", { name: "Attached from Paper" })
    ).toBeInTheDocument()

    fireEvent.change(messageCoach(dialog), {
      target: { value: "Read the attached CV" },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Send" }))
    expect(
      await within(dialog).findByText("I have the CV attached.")
    ).toBeInTheDocument()
    expect(getLastCoachRequest()?.focusDocId).toBe(
      "11111111-1111-7111-8111-111111111111"
    )
    expect(
      within(dialog).queryByRole("status", { name: "Attached from Paper" })
    ).not.toBeInTheDocument()
  })
})
