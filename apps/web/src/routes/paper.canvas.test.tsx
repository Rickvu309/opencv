import { describe, expect, it, vi } from "vitest"
import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { isCvDocument } from "@workspace/domain"
import { SAMPLE_AUTHOR_NAME } from "@/features/seed/sample-author.ts"
import { getMockPaperDocs } from "@/test/paper-api-mock.ts"
import { expectPaperDrive } from "@/test/paper-drive.ts"
import {
  queryByAttr,
  installPaperTestLifecycle,
  renderPaper,
  openDoc,
  openCoach,
  messageCoach,
  selectNodeContents,
  stubDesktopViewport,
} from "@/test/paper-route-fixtures.ts"

installPaperTestLifecycle()

describe("Paper canvas editors", () => {
  it("opens a CV on A4 and switches among the five templates", async () => {
    renderPaper()
    await expectPaperDrive()
    await openDoc("PM track CV")

    expect(screen.getByText("Profile")).toBeInTheDocument()
    expect(screen.getAllByText(SAMPLE_AUTHOR_NAME).length).toBeGreaterThan(0)
    expect(screen.getByRole("textbox", { name: "Summary" })).toBeInTheDocument()

    const cvTools = screen.getByRole("toolbar", { name: "CV tools" })
    expect(
      within(cvTools).getByRole("button", { name: "Insert" })
    ).toBeInTheDocument()
    expect(
      within(cvTools).getByRole("button", { name: "Export" })
    ).toBeInTheDocument()
    expect(
      within(cvTools).queryByRole("button", { name: "Bold" })
    ).not.toBeInTheDocument()
    expect(
      within(cvTools).queryByRole("button", { name: "Italic" })
    ).not.toBeInTheDocument()
    expect(
      within(cvTools).queryByRole("button", { name: "Bullet list" })
    ).not.toBeInTheDocument()
    expect(queryByAttr(document, "data-cv-type='page-title'")).not.toBeNull()
    expect(queryByAttr(document, "data-cv-type='body'")).not.toBeNull()

    fireEvent.click(screen.getByRole("button", { name: /Product & design/ }))
    const templates = await screen.findByRole("listbox", {
      name: "CV templates",
    })
    expect(
      within(templates).getByRole("option", { name: /Classic internship/ })
    ).toBeInTheDocument()
    expect(
      within(templates).getByRole("option", { name: /Product & design/ })
    ).toBeInTheDocument()
    expect(
      within(templates).getByRole("option", { name: /Project-led/ })
    ).toBeInTheDocument()
    expect(
      within(templates).getByRole("option", { name: /Campus & projects/ })
    ).toBeInTheDocument()
    expect(
      within(templates).getByRole("option", { name: /With photo/ })
    ).toBeInTheDocument()

    fireEvent.click(
      within(templates).getByRole("option", { name: /Classic internship/ })
    )
    expect(await screen.findByText("Summary")).toBeInTheDocument()
    expect(screen.queryByText("Profile")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /Classic internship/ }))
    fireEvent.click(
      within(
        await screen.findByRole("listbox", { name: "CV templates" })
      ).getByRole("option", { name: /With photo/ })
    )
    expect(
      await screen.findByRole("button", { name: /profile photo/i })
    ).toBeInTheDocument()
  })

  it("shows quiet canvas focus chrome on Summary and Experience bullets", async () => {
    stubDesktopViewport(true)
    renderPaper()
    await expectPaperDrive()
    const editor = await openDoc("PM track CV")

    const summary = within(editor).getByRole("textbox", { name: "Summary" })
    const bullet = within(editor).getAllByRole("textbox", {
      name: "Bullet point",
    })[0]
    expect(bullet).toBeTruthy()

    for (const field of [summary, bullet!]) {
      expect(field).toHaveAttribute("data-paper-canvas-field")

      fireEvent.click(field)
      field.focus()
      expect(field).toHaveFocus()

      fireEvent.keyDown(field, { key: "Escape" })
      expect(field).not.toHaveFocus()

      field.focus()
      expect(field).toHaveFocus()
      field.blur()
      expect(field).not.toHaveFocus()
    }

    expect(
      screen.queryByRole("status", { name: "In context" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("status", { name: "Selected text" })
    ).not.toBeInTheDocument()
    expect(queryByAttr(editor, "data-coach-context-chip")).toBeNull()
  })

  it("keeps canvas field selection chrome distinct from CoachFloat chips", async () => {
    stubDesktopViewport(true)
    renderPaper()
    await expectPaperDrive()
    const editor = await openDoc("PM track CV")
    const dialog = await openCoach()
    const bullet = within(editor).getAllByRole("textbox", {
      name: "Bullet point",
    })[0]!

    expect(bullet).toHaveAttribute("data-paper-canvas-field")
    expect(bullet).not.toHaveAttribute("data-coach-selection-preview")

    selectNodeContents(bullet)
    messageCoach(dialog).focus()

    const preview = await within(dialog).findByRole("status", {
      name: "Selected text",
    })
    expect(preview).toHaveAttribute("data-coach-selection-preview")
    expect(preview).not.toHaveAttribute("data-paper-canvas-field")

    const softScope = within(dialog).getByRole("status", { name: "In context" })
    expect(softScope).toHaveAttribute("data-coach-soft-scope")
    expect(softScope).not.toHaveAttribute("data-paper-canvas-field")
    expect(softScope).not.toBe(preview)
  })

  it("mutates Experience and Skills on the Sample CV and persists after refresh", async () => {
    stubDesktopViewport(true)
    const first = renderPaper()
    await expectPaperDrive()
    const editor = await openDoc("PM track CV")

    const bulletsBefore = within(editor).getAllByRole("textbox", {
      name: "Bullet point",
    })
    fireEvent.click(
      within(editor).getAllByRole("button", { name: "Add bullet" })[0]!
    )
    expect(
      within(editor).getAllByRole("textbox", { name: "Bullet point" })
    ).toHaveLength(bulletsBefore.length + 1)

    const skill = within(editor).getAllByRole("textbox", { name: "Skill" })[0]!
    skill.textContent = "Café interviews"
    fireEvent.input(skill)
    expect(skill).toHaveTextContent("Café interviews")

    await waitFor(
      () => {
        const cv = getMockPaperDocs().find((doc) => doc.name === "PM track CV")
        expect(cv && isCvDocument(cv.content)).toBe(true)
        if (!cv || !isCvDocument(cv.content)) return
        expect(cv.content.experience[0]?.bullets).toHaveLength(3)
        expect(cv.content.skills[0]?.items[0]).toBe("Café interviews")
      },
      { timeout: 2000 }
    )
    expect(screen.getByRole("button", { name: "Saved" })).toBeInTheDocument()

    first.unmount()
    renderPaper()
    await expectPaperDrive()
    const again = await openDoc("PM track CV")
    expect(
      within(again).getAllByRole("textbox", { name: "Bullet point" })
    ).toHaveLength(bulletsBefore.length + 1)
    expect(within(again).getByText("Café interviews")).toBeInTheDocument()
    expect(
      screen.queryByRole("status", { name: "In context" })
    ).not.toBeInTheDocument()
  })

  it("undoes and redoes Experience + Summary after autosave on desktop", async () => {
    stubDesktopViewport(true)
    const exec = vi.spyOn(document, "execCommand")
    renderPaper()
    await expectPaperDrive()
    const editor = await openDoc("PM track CV")
    const toolbar = within(editor).getByRole("toolbar", { name: "CV tools" })

    const summary = within(editor).getByRole("textbox", { name: "Summary" })
    const priorSummary = summary.textContent ?? ""
    expect(priorSummary.length).toBeGreaterThan(0)
    summary.textContent = "Café rewrite of the summary"
    fireEvent.input(summary)

    const role = within(editor).getAllByRole("textbox", { name: "Role" })[0]!
    const priorRole = role.textContent ?? ""
    expect(priorRole.length).toBeGreaterThan(0)
    role.textContent = "Café barista lead"
    fireEvent.input(role)

    await waitFor(
      () => {
        expect(
          screen.getByRole("button", { name: "Saved" })
        ).toBeInTheDocument()
        const cv = getMockPaperDocs().find((doc) => doc.name === "PM track CV")
        expect(cv && isCvDocument(cv.content)).toBe(true)
        if (!cv || !isCvDocument(cv.content)) return
        expect(cv.content.summary).toBe("Café rewrite of the summary")
        expect(cv.content.experience[0]?.role).toBe("Café barista lead")
      },
      { timeout: 2000 }
    )

    const undo = within(toolbar).getByRole("button", { name: "Undo" })
    const redo = within(toolbar).getByRole("button", { name: "Redo" })
    expect(undo).toBeEnabled()
    expect(redo).toBeDisabled()

    fireEvent.mouseDown(undo)
    expect(role).toHaveTextContent(priorRole)
    expect(summary).toHaveTextContent("Café rewrite of the summary")

    fireEvent.mouseDown(undo)
    expect(summary).toHaveTextContent(priorSummary)
    expect(role).toHaveTextContent(priorRole)
    expect(redo).toBeEnabled()

    fireEvent.mouseDown(redo)
    expect(summary).toHaveTextContent("Café rewrite of the summary")
    fireEvent.mouseDown(redo)
    expect(role).toHaveTextContent("Café barista lead")

    fireEvent.keyDown(role, { key: "z", metaKey: true })
    expect(role).toHaveTextContent(priorRole)
    fireEvent.keyDown(role, { key: "z", metaKey: true, shiftKey: true })
    expect(role).toHaveTextContent("Café barista lead")

    expect(exec).not.toHaveBeenCalledWith(
      "undo",
      expect.anything(),
      expect.anything()
    )
    expect(exec).not.toHaveBeenCalledWith(
      "redo",
      expect.anything(),
      expect.anything()
    )
    exec.mockRestore()
  })

  it("tabs between CV fields and Esc blurs on desktop without trapping", async () => {
    stubDesktopViewport(true)
    renderPaper()
    await expectPaperDrive()
    const editor = await openDoc("PM track CV")

    const name = within(editor).getByRole("textbox", { name: "Your name" })
    const headline = within(editor).getByRole("textbox", { name: "Headline" })
    name.focus()
    fireEvent.keyDown(name, { key: "Tab" })
    expect(headline).toHaveFocus()

    fireEvent.keyDown(headline, { key: "Tab", shiftKey: true })
    expect(name).toHaveFocus()

    fireEvent.keyDown(name, { key: "Escape" })
    expect(name).not.toHaveFocus()
    expect(editor.contains(document.activeElement)).toBe(false)

    const dialog = await openCoach()
    expect(dialog).not.toHaveAttribute("draggable")
    expect(queryByAttr(dialog, "data-coach-float-resize")).toBeNull()
  })

  it("fits A4 to a phone width with slim chrome and a usable edit", async () => {
    stubDesktopViewport(false)
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 390,
    })
    renderPaper()
    await expectPaperDrive()
    const editor = await openDoc("PM track CV")

    expect(
      screen.queryByRole("complementary", { name: "Paper list" })
    ).not.toBeInTheDocument()

    const fit = queryByAttr(editor, "data-paper-a4-fit='width'")
    expect(fit).toBeInstanceOf(HTMLElement)
    const page = fit!.firstElementChild as HTMLElement
    expect(page.style.maxWidth).toBe("100%")
    expect(page.style.width).toBe("210mm")

    expect(queryByAttr(editor, "data-paper-canvas")).toBeInstanceOf(HTMLElement)
    expect(queryByAttr(editor, "data-paper-editor")).not.toBeNull()

    const toolbar = within(editor).getByRole("toolbar", { name: "CV tools" })
    expect(toolbar).toHaveAttribute("data-paper-toolbar")

    const summary = within(editor).getByRole("textbox", { name: "Summary" })
    expect(summary).toHaveAttribute("data-paper-canvas-field")
    summary.textContent = "Café rewrite on a phone"
    fireEvent.input(summary)
    expect(summary).toHaveTextContent("Café rewrite on a phone")

    fireEvent.keyDown(summary, { key: "Escape" })
    expect(summary).not.toHaveFocus()

    const name = within(editor).getByRole("textbox", { name: "Your name" })
    const headline = within(editor).getByRole("textbox", { name: "Headline" })
    name.focus()
    fireEvent.keyDown(name, { key: "Tab" })
    expect(headline).toHaveFocus()

    expect(screen.getByRole("button", { name: "Coach" })).toBeInTheDocument()
    expect(queryByAttr(document, "data-coach-float-resize")).toBeNull()
  })
})
