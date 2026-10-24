import { describe, expect, it } from "vitest"
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { STARTER_CV_NAME, starterCvDocument } from "@workspace/domain"
import { EMPTY_SECTION_CTA } from "@/features/paper/paper-cv-edits.ts"
import { SAMPLE_CV_LABEL } from "@/features/paper/paper-data.ts"
import { expectPaperDrive } from "@/test/paper-drive.ts"
import {
  byAttr,
  installPaperTestLifecycle,
  renderPaper,
  openDoc,
  ownedSampleCvName,
  seedSampleInternshipCv,
  sampleInternshipCv,
  sampleSkillItems,
  goHomeThenPaper,
  stubDesktopViewport,
} from "@/test/paper-route-fixtures.ts"

installPaperTestLifecycle()

describe("Paper content editors", () => {
  it("persists Sample internship CV skill chips across Home → Paper", async () => {
    stubDesktopViewport(true)
    seedSampleInternshipCv()
    renderPaper()
    await expectPaperDrive()
    const editor = await openDoc(STARTER_CV_NAME)

    const bulletsBefore = within(editor).getAllByRole("textbox", {
      name: "Bullet point",
    })
    const firstRoleBulletCount =
      starterCvDocument().experience[0]?.bullets.length ?? 0
    fireEvent.click(
      within(editor).getAllByRole("button", { name: "Add bullet" })[0]!
    )
    const experienceMarker = "QVE207-persist-marker-1207"
    const addedBullet = within(editor).getAllByRole("textbox", {
      name: "Bullet point",
    })[firstRoleBulletCount]!
    addedBullet.textContent = experienceMarker
    fireEvent.input(addedBullet)

    fireEvent.click(
      within(editor).getAllByRole("button", { name: "Add skill" })[0]!
    )
    const addedSkill = within(editor)
      .getAllByRole("textbox", { name: "Skill" })
      .at(-1)!
    addedSkill.textContent = "QVE207SkillMarker"
    fireEvent.input(addedSkill)

    await goHomeThenPaper()
    await waitFor(() => {
      expect(sampleSkillItems()).toContain("QVE207SkillMarker")
      expect(sampleInternshipCv().content.experience[0]?.bullets).toContain(
        experienceMarker
      )
      expect(sampleInternshipCv().name).toBe(ownedSampleCvName())
    })
    expect(screen.queryByText(STARTER_CV_NAME)).not.toBeInTheDocument()
    expect(screen.queryByText(SAMPLE_CV_LABEL)).not.toBeInTheDocument()

    const again = await openDoc(ownedSampleCvName())
    expect(within(again).getByText("QVE207SkillMarker")).toBeInTheDocument()
    expect(within(again).getByText(experienceMarker)).toBeInTheDocument()
    expect(
      within(again).getAllByRole("textbox", { name: "Bullet point" })
    ).toHaveLength(bulletsBefore.length + 1)

    const renamed = "QVE207SkillRenamed"
    const skillFields = within(again).getAllByRole("textbox", { name: "Skill" })
    const markerField =
      skillFields.find((field) => field.textContent === "QVE207SkillMarker") ??
      skillFields.at(-1)!
    markerField.textContent = renamed
    fireEvent.input(markerField)

    await goHomeThenPaper()
    await waitFor(() => {
      expect(sampleSkillItems()).toContain(renamed)
      expect(sampleSkillItems()).not.toContain("QVE207SkillMarker")
    })

    const afterRename = await openDoc(ownedSampleCvName())
    expect(within(afterRename).getByText(renamed)).toBeInTheDocument()
    fireEvent.click(
      within(afterRename)
        .getAllByRole("button", { name: "Remove skill" })
        .at(-1)!
    )

    await goHomeThenPaper()
    await waitFor(() => {
      expect(sampleSkillItems()).not.toContain(renamed)
    })

    const afterRemove = await openDoc(ownedSampleCvName())
    expect(within(afterRemove).queryByText(renamed)).not.toBeInTheDocument()
    expect(within(afterRemove).getByText(experienceMarker)).toBeInTheDocument()
  })

  it("reopens Sample internship CV skills after remount/reload", async () => {
    stubDesktopViewport(true)
    seedSampleInternshipCv()
    const first = renderPaper()
    await expectPaperDrive()
    const editor = await openDoc(STARTER_CV_NAME)

    fireEvent.click(
      within(editor).getAllByRole("button", { name: "Add skill" })[0]!
    )
    const addedSkill = within(editor)
      .getAllByRole("textbox", { name: "Skill" })
      .at(-1)!
    addedSkill.textContent = "QVE207ReloadMarker"
    fireEvent.input(addedSkill)

    const firstSkill = within(editor).getAllByRole("textbox", {
      name: "Skill",
    })[0]!
    firstSkill.textContent = "QVE207ReloadRename"
    fireEvent.input(firstSkill)

    await waitFor(() => {
      expect(sampleSkillItems()).toContain("QVE207ReloadMarker")
      expect(sampleSkillItems()).toContain("QVE207ReloadRename")
      expect(sampleInternshipCv().name).toBe(ownedSampleCvName())
    })
    expect(screen.getByRole("button", { name: "Saved" })).toBeInTheDocument()
    expect(screen.queryByText(SAMPLE_CV_LABEL)).not.toBeInTheDocument()

    first.unmount()
    cleanup()
    renderPaper()
    await expectPaperDrive()
    expect(screen.queryByText(STARTER_CV_NAME)).not.toBeInTheDocument()
    expect(screen.queryByText(SAMPLE_CV_LABEL)).not.toBeInTheDocument()
    const reloaded = await openDoc(ownedSampleCvName())
    expect(within(reloaded).getByText("QVE207ReloadMarker")).toBeInTheDocument()
    expect(within(reloaded).getByText("QVE207ReloadRename")).toBeInTheDocument()
  })

  it("shows one next-step CTA after clearing a section and inserts a usable row", async () => {
    stubDesktopViewport(true)
    renderPaper()
    await expectPaperDrive()
    const editor = await openDoc("PM track CV")

    while (
      within(editor).queryAllByRole("textbox", { name: "Role" }).length > 0
    ) {
      fireEvent.click(
        within(editor).getAllByRole("button", { name: "Remove role" })[0]!
      )
    }

    const addRole = within(editor).getByRole("button", {
      name: EMPTY_SECTION_CTA.experience,
    })
    expect(addRole).toBeEnabled()
    expect(
      within(editor).queryByRole("button", {
        name: EMPTY_SECTION_CTA.education,
      })
    ).not.toBeInTheDocument()
    expect(byAttr(editor, "data-slot='empty'")).toBeNull()
    expect(within(editor).queryByText(/get started/i)).not.toBeInTheDocument()

    fireEvent.click(addRole)
    expect(
      within(editor).getByRole("textbox", { name: "Role" })
    ).toHaveTextContent("Role title")
    expect(
      within(editor).queryByRole("button", {
        name: EMPTY_SECTION_CTA.experience,
      })
    ).not.toBeInTheDocument()

    while (
      within(editor).queryAllByRole("textbox", { name: "Skill" }).length > 0
    ) {
      fireEvent.click(
        within(editor).getAllByRole("button", { name: "Remove skill" })[0]!
      )
    }
    fireEvent.click(
      within(editor).getByRole("button", { name: EMPTY_SECTION_CTA.skills })
    )
    expect(
      within(editor).getAllByRole("textbox", { name: "Skill" }).length
    ).toBeGreaterThan(0)

    fireEvent.click(
      within(editor).getByRole("button", { name: "Remove school" })
    )
    fireEvent.click(
      within(editor).getByRole("button", { name: EMPTY_SECTION_CTA.education })
    )
    expect(
      within(editor).getByRole("textbox", { name: "School" })
    ).toHaveTextContent("School name")
    expect(byAttr(editor, "data-slot='empty'")).toBeNull()
  })

  it("opens and edits a Letter", async () => {
    renderPaper()
    await expectPaperDrive()
    await openDoc("Cover: Associate PM intern")

    const editor = screen.getByRole("textbox", { name: "Document content" })
    expect(editor).toHaveAttribute("contenteditable", "true")
    expect(editor).toHaveTextContent(/associate product manager intern/i)
    expect(editor).toHaveTextContent(new RegExp(`Best,\\s*Alex`))
    expect(editor).not.toHaveTextContent(/Eric/)

    editor.textContent = "Edited letter draft"
    fireEvent.input(editor)
    expect(editor).toHaveTextContent("Edited letter draft")
  })

  it("opens and edits a Proof, including the timeline view", async () => {
    renderPaper()
    await expectPaperDrive()
    await openDoc("Checkout card resize study")

    const title = screen.getByRole("textbox", { name: "Proof title" })
    expect(title).toHaveValue("Product card resize study")
    expect(screen.getByText("Context")).toBeInTheDocument()
    expect(screen.getByText("What I did")).toBeInTheDocument()
    expect(screen.getByText("Outcome")).toBeInTheDocument()

    fireEvent.change(title, { target: { value: "Checkout study rewrite" } })
    expect(title).toHaveValue("Checkout study rewrite")

    fireEvent.click(screen.getByRole("button", { name: "Timeline" }))
    expect(screen.getByText("Timeline preview")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Expand all" })
    ).toBeInTheDocument()
  })
})

describe("Paper documents panel", () => {
  it("hides and shows the sidebar so the canvas can use full width", async () => {
    renderPaper()
    await expectPaperDrive()
    const editor = await openDoc("PM track CV")

    const toggle = within(editor).getByRole("button", { name: "Documents" })
    expect(toggle).toHaveAttribute("aria-expanded", "true")
    expect(toggle).toHaveAttribute("aria-controls", "paper-docs-panel")
    expect(toggle.textContent?.trim()).toBe("")

    const sidebar = screen.getByRole("complementary", { name: "Documents" })
    expect(sidebar).toHaveAttribute("id", "paper-docs-panel")
    expect(editor.children).toHaveLength(2)

    const docRow = within(sidebar).getByRole("button", { name: /PM track CV/ })
    expect(docRow).toBeEnabled()

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute("aria-expanded", "false")
    expect(
      screen.queryByRole("complementary", { name: "Documents" })
    ).not.toBeInTheDocument()
    expect(editor.children).toHaveLength(1)
    expect(localStorage.getItem("opencv:paper:docs-panel")).toBe("collapsed")

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute("aria-expanded", "true")
    expect(
      screen.getByRole("complementary", { name: "Documents" })
    ).toBeInTheDocument()
    expect(editor.children).toHaveLength(2)
    expect(localStorage.getItem("opencv:paper:docs-panel")).toBe("expanded")
  })

  it("restores a saved collapsed preference after remount", async () => {
    localStorage.setItem("opencv:paper:docs-panel", "collapsed")
    const first = renderPaper()
    await expectPaperDrive()
    const firstEditor = await openDoc("PM track CV")

    expect(
      screen.queryByRole("complementary", { name: "Documents" })
    ).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Documents" })).toHaveAttribute(
      "aria-expanded",
      "false"
    )
    expect(firstEditor.children).toHaveLength(1)

    first.unmount()
    cleanup()

    renderPaper()
    await expectPaperDrive()
    const secondEditor = await openDoc("PM track CV")
    expect(
      screen.queryByRole("complementary", { name: "Documents" })
    ).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Documents" })).toHaveAttribute(
      "aria-expanded",
      "false"
    )
    expect(secondEditor.children).toHaveLength(1)
    expect(localStorage.getItem("opencv:paper:docs-panel")).toBe("collapsed")
  })

  it("defaults expanded on first visit and ignores invalid storage", async () => {
    localStorage.setItem("opencv:paper:docs-panel", "hidden")
    renderPaper()
    await expectPaperDrive()
    await openDoc("PM track CV")

    expect(
      screen.getByRole("complementary", { name: "Documents" })
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Documents" })).toHaveAttribute(
      "aria-expanded",
      "true"
    )
  })

  it("leaves the drive view without a documents panel or toggle", async () => {
    renderPaper()
    await expectPaperDrive()

    expect(
      screen.queryByRole("button", { name: "Documents" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("complementary", { name: "Documents" })
    ).not.toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Paper" })).toBeInTheDocument()
    expect(
      screen.getByRole("textbox", { name: "Search documents" })
    ).toBeInTheDocument()
  })
})
