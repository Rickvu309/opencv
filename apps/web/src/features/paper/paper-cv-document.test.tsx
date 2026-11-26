import { readFileSync } from "node:fs"
import path from "node:path"
import { createElement, useReducer } from "react"
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"

import {
  CvDocument,
  EditableField,
  PAPER_CANVAS_AFFORDANCE_CLASS,
  PAPER_CANVAS_BLOCK_CLASS,
  PAPER_CANVAS_FIELD_CLASS,
  PAPER_CANVAS_NEXT_STEP_CLASS,
} from "./cv-print-document.tsx"
import { BLANK_EDUCATION, EMPTY_SECTION_CTA } from "./cv-templates/cv-edits.ts"
import {
  CV_TEMPLATES,
  CV_TYPE_ROLES,
  defaultCvData,
  type CvData,
  type CvTemplateId,
} from "./cv-templates/cv-types.ts"

function applyCvTemplate(data: CvData, templateId: CvTemplateId): CvData {
  return { ...data, templateId }
}

afterEach(() => {
  cleanup()
})

const paperCss = readFileSync(
  path.join(process.cwd(), "src/styles/paper.css"),
  "utf8"
)

function replaceData(_: CvData, next: CvData) {
  return next
}

function renderCv(
  templateId: CvTemplateId,
  seed?: CvData,
  placeholders = true
) {
  function Harness() {
    const [data, setData] = useReducer(replaceData, undefined, () =>
      applyCvTemplate(seed ?? defaultCvData(), templateId)
    )
    return createElement(CvDocument, {
      data,
      onChange: setData,
      placeholders,
    })
  }
  return render(createElement(Harness))
}

function emptySections(data: CvData = defaultCvData()): CvData {
  return { ...data, experience: [], education: [], skills: [] }
}

describe("CV print-paper type rhythm", () => {
  it("marks the type roles on every default template", () => {
    for (const template of CV_TEMPLATES) {
      cleanup()
      renderCv(template.id)

      for (const role of CV_TYPE_ROLES) {
        expect(
          document.querySelector(`[data-cv-type="${role}"]`),
          `${template.name} is missing ${role}`
        ).not.toBeNull()
      }

      const name = screen.getByRole("textbox", { name: "Name" })
      expect(name.closest("[data-cv-type='page-title']")).not.toBeNull()

      const headline = screen.getByRole("textbox", { name: "Headline" })
      expect(headline.closest("[data-cv-type='body']")).not.toBeNull()
    }
  })
})

describe("EditableField canvas chrome (QVE-206)", () => {
  it("uses quiet paper-canvas chrome instead of a heavy form field", () => {
    render(
      createElement(EditableField, {
        "aria-label": "Summary",
        value: "A short summary",
        onChange: () => {},
      })
    )
    const field = screen.getByRole("textbox", { name: "Summary" })
    expect(field).toHaveClass(PAPER_CANVAS_FIELD_CLASS)
    expect(field).toHaveAttribute("data-paper-canvas-field")
    expect(field.className).not.toMatch(/bg-muted\/80/)
    expect(field.className).not.toMatch(/border-input/)
    expect(field.className).not.toMatch(/focus:ring-1/)
    expect(field.className).not.toMatch(/rounded-full/)
  })

  it("shows focus on click and clears on blur and Escape", () => {
    render(
      createElement(EditableField, {
        "aria-label": "Bullet point",
        value: "Ran weekly café shifts",
        onChange: () => {},
        multiline: true,
      })
    )
    const field = screen.getByRole("textbox", { name: "Bullet point" })

    fireEvent.click(field)
    field.focus()
    expect(field).toHaveFocus()

    field.blur()
    expect(field).not.toHaveFocus()

    field.focus()
    expect(field).toHaveFocus()
    fireEvent.keyDown(field, { key: "Escape" })
    expect(field).not.toHaveFocus()
  })

  it("resyncs a focused field when history revision bumps (QVE-210)", () => {
    const view = render(
      createElement(EditableField, {
        "aria-label": "Summary",
        value: "Café rewrite",
        historyRevision: 0,
        onChange: () => {},
      })
    )
    const field = screen.getByRole("textbox", { name: "Summary" })
    field.focus()
    expect(field).toHaveFocus()
    field.textContent = "Café rewrite"
    view.rerender(
      createElement(EditableField, {
        "aria-label": "Summary",
        value: "A short summary",
        historyRevision: 1,
        onChange: () => {},
      })
    )
    expect(field).toHaveTextContent("A short summary")
    expect(field).toHaveFocus()
  })
})

describe("EditableField café keyboard (QVE-208)", () => {
  it("Tabs between structured fields and Esc blurs without trapping", () => {
    renderCv("internship", undefined, false)
    const name = screen.getByRole("textbox", { name: "Name" })
    const headline = screen.getByRole("textbox", { name: "Headline" })
    const contacts = screen.getAllByRole("textbox", { name: "Contact detail" })

    name.focus()
    fireEvent.keyDown(name, { key: "Tab" })
    expect(headline).toHaveFocus()

    fireEvent.keyDown(headline, { key: "Tab" })
    expect(contacts[0]).toHaveFocus()

    fireEvent.keyDown(contacts[0]!, { key: "Tab", shiftKey: true })
    expect(headline).toHaveFocus()

    fireEvent.keyDown(headline, { key: "Escape" })
    expect(headline).not.toHaveFocus()
    expect(document.activeElement === headline).toBe(false)
  })
})

describe("paper canvas field CSS (QVE-206)", () => {
  it("uses a muted wash with no coloured glow, not cite-jump info or Coach pills", () => {
    expect(paperCss).toMatch(/\.paper-canvas-field:focus/)
    expect(paperCss).toMatch(/var\(--muted\)/)
    expect(paperCss).toMatch(/\.paper-canvas-field::selection/)
    expect(paperCss).toMatch(/currentColor/)

    const start = paperCss.indexOf(".paper-canvas-field {")
    const end = paperCss.indexOf(".cv-a4-fit {")
    const chrome = paperCss.slice(start, end).replace(/\/\*[\s\S]*?\*\//g, "")
    expect(chrome).toContain(".paper-canvas-field:focus")
    expect(chrome).toContain("var(--muted)")
    expect(chrome).not.toMatch(/box-shadow:[^;]*var\(--ring\)/)
    expect(chrome).not.toMatch(/var\(--info\)/)
    expect(chrome).not.toMatch(/rounded-full/)
    expect(chrome).not.toMatch(/bg-muted\/70/)
  })
})

describe("on-canvas Experience and Skills edits (QVE-207)", () => {
  it("adds and deletes bullets and duplicates or removes a role", () => {
    renderCv("product")
    const bulletsBefore = screen.getAllByRole("textbox", {
      name: "Bullet point",
    })
    const rolesBefore = screen.getAllByRole("textbox", { name: "Role" })

    fireEvent.click(screen.getAllByRole("button", { name: "Add bullet" })[0]!)
    expect(
      screen.getAllByRole("textbox", { name: "Bullet point" })
    ).toHaveLength(bulletsBefore.length + 1)

    fireEvent.click(
      screen.getAllByRole("button", { name: "Remove bullet" })[0]!
    )
    expect(
      screen.getAllByRole("textbox", { name: "Bullet point" })
    ).toHaveLength(bulletsBefore.length)

    fireEvent.click(
      screen.getAllByRole("button", { name: "Duplicate role" })[0]!
    )
    expect(screen.getAllByRole("textbox", { name: "Role" })).toHaveLength(
      rolesBefore.length + 1
    )

    fireEvent.click(screen.getAllByRole("button", { name: "Remove role" })[0]!)
    expect(screen.getAllByRole("textbox", { name: "Role" })).toHaveLength(
      rolesBefore.length
    )
  })

  it("keeps internship skill add and rename after remount", () => {
    let latest = applyCvTemplate(defaultCvData(), "internship")
    function Harness() {
      const [data, setData] = useReducer(replaceData, latest)
      return createElement(CvDocument, {
        data,
        placeholders: true,
        onChange: (next: typeof data) => {
          latest = next
          setData(next)
        },
      })
    }

    const first = render(createElement(Harness))
    fireEvent.click(screen.getAllByRole("button", { name: "Add skill" })[0]!)
    const added = screen.getAllByRole("textbox", { name: "Skill" }).at(-1)!
    added.textContent = "QVE207SkillMarker"
    fireEvent.input(added)
    expect(latest.skills.flatMap((group) => group.items)).toContain(
      "QVE207SkillMarker"
    )
    first.unmount()
    cleanup()

    render(createElement(CvDocument, { data: latest, onChange: () => {} }))
    expect(screen.getByText("QVE207SkillMarker")).toBeInTheDocument()
  })

  it("edits Skills as chips by renaming, adding and removing them", () => {
    renderCv("product")
    const chips = screen.getAllByRole("textbox", { name: "Skill" })
    expect(chips.length).toBeGreaterThan(1)

    const first = chips[0]!
    first.textContent = "Café interviews"
    fireEvent.input(first)
    expect(first).toHaveTextContent("Café interviews")

    fireEvent.click(screen.getAllByRole("button", { name: "Add skill" })[0]!)
    expect(screen.getAllByRole("textbox", { name: "Skill" })).toHaveLength(
      chips.length + 1
    )

    fireEvent.click(screen.getAllByRole("button", { name: "Remove skill" })[0]!)
    expect(screen.getAllByRole("textbox", { name: "Skill" })).toHaveLength(
      chips.length
    )
    expect(screen.queryByText("Café interviews")).not.toBeInTheDocument()
  })

  it("makes Service education and Academic projects editable", () => {
    renderCv("service")
    const school = screen.getByRole("textbox", { name: "School" })
    school.textContent = "Campus café lab"
    fireEvent.input(school)
    expect(school).toHaveTextContent("Campus café lab")
    expect(screen.getByRole("textbox", { name: "Degree" })).toBeInTheDocument()
    expect(
      screen.getAllByRole("textbox", { name: "Skill" }).length
    ).toBeGreaterThan(0)

    cleanup()
    renderCv("academic")
    const project = screen.getAllByRole("textbox", { name: "Project name" })[0]!
    project.textContent = "Hackathon booth"
    fireEvent.input(project)
    expect(project).toHaveTextContent("Hackathon booth")
    expect(
      screen.getByRole("textbox", { name: "Education detail" })
    ).toBeInTheDocument()
    expect(
      screen.getAllByRole("textbox", { name: "Project detail" }).length
    ).toBeGreaterThan(0)
  })

  it("keeps hover affordances on the canvas, not only in a toolbar", () => {
    renderCv("internship")
    const block = document.querySelector("[data-paper-section='experience-0']")
    expect(block).toHaveClass(PAPER_CANVAS_BLOCK_CLASS)
    expect(
      screen.getAllByRole("button", { name: "Add bullet" })[0]
    ).toHaveClass(PAPER_CANVAS_AFFORDANCE_CLASS)
    expect(
      screen.getAllByRole("button", { name: "Duplicate role" })[0]
    ).toHaveClass(PAPER_CANVAS_AFFORDANCE_CLASS)
    expect(screen.queryByRole("toolbar")).not.toBeInTheDocument()
  })
})

describe("paper canvas affordance CSS (QVE-207)", () => {
  it("reveals kit hover chrome, not Coach pills or cite-jump", () => {
    expect(paperCss).toMatch(/\.paper-canvas-block:hover/)
    expect(paperCss).toMatch(/\.paper-canvas-affordance:focus-visible/)
    expect(paperCss).toMatch(/display:\s*none/)

    const start = paperCss.indexOf(".paper-canvas-block {")
    const end = paperCss.indexOf(".cv-a4-fit {")
    const chrome = paperCss.slice(start, end).replace(/\/\*[\s\S]*?\*\//g, "")
    expect(chrome).toContain(".paper-canvas-affordance")
    expect(chrome).toContain("var(--duration-micro)")
    expect(chrome).not.toMatch(/var\(--info\)/)
    expect(chrome).not.toMatch(/rounded-full/)
    expect(chrome).not.toMatch(/bg-muted\/70/)
  })
})

describe("paper café density CSS (QVE-208)", () => {
  it("fits A4 to width and enlarges tap targets under the phone breakpoint", () => {
    expect(paperCss).toMatch(/@media \(max-width:\s*767px\)/)
    expect(paperCss).toMatch(/min-height:\s*2\.75rem/)
    expect(paperCss).toMatch(/\[data-paper-toolbar\]/)
    expect(paperCss).toMatch(/\[data-paper-editor\] > header/)

    const start = paperCss.indexOf(".cv-a4-fit {")
    const end = paperCss.indexOf("@keyframes paper-coach-highlight")
    const cafe = paperCss.slice(start, end)
    expect(cafe).toContain("max-width: 100%")
    expect(cafe).toContain("min-height: 2.75rem")
    expect(cafe).toContain("min-width: 2.75rem")
    expect(cafe).not.toMatch(/transform:\s*scale/)
    expect(cafe).not.toMatch(/var\(--info\)/)
  })
})

describe("empty section next-step CTAs (QVE-209)", () => {
  it("shows one quiet CTA per empty Experience, Education, and Skills", () => {
    renderCv("product", emptySections())

    expect(
      screen.getByRole("button", { name: EMPTY_SECTION_CTA.experience })
    ).toHaveClass(PAPER_CANVAS_NEXT_STEP_CLASS)
    expect(
      screen.getByRole("button", { name: EMPTY_SECTION_CTA.education })
    ).toHaveClass(PAPER_CANVAS_NEXT_STEP_CLASS)
    expect(
      screen.getByRole("button", { name: EMPTY_SECTION_CTA.skills })
    ).toHaveClass(PAPER_CANVAS_NEXT_STEP_CLASS)

    expect(screen.getAllByRole("button", { name: /Add first / })).toHaveLength(
      3
    )
    expect(document.querySelector("[data-slot='empty']")).toBeNull()
    expect(screen.queryByText(/get started/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/no experience/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Add text/)).not.toBeInTheDocument()
  })

  it("inserts a usable row from each empty-section CTA", () => {
    renderCv("internship", emptySections())

    fireEvent.click(
      screen.getByRole("button", { name: EMPTY_SECTION_CTA.experience })
    )
    expect(screen.getByRole("textbox", { name: "Role" })).toHaveTextContent(
      "Role title"
    )
    expect(screen.getByRole("textbox", { name: "Company" })).toHaveTextContent(
      "Company"
    )
    expect(
      screen.queryByRole("button", { name: EMPTY_SECTION_CTA.experience })
    ).not.toBeInTheDocument()

    fireEvent.click(
      screen.getByRole("button", { name: EMPTY_SECTION_CTA.education })
    )
    expect(screen.getByRole("textbox", { name: "School" })).toHaveTextContent(
      BLANK_EDUCATION.school
    )
    expect(
      screen.queryByRole("button", { name: EMPTY_SECTION_CTA.education })
    ).not.toBeInTheDocument()

    fireEvent.click(
      screen.getByRole("button", { name: EMPTY_SECTION_CTA.skills })
    )
    expect(screen.getByRole("textbox", { name: "Skill" })).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: EMPTY_SECTION_CTA.skills })
    ).not.toBeInTheDocument()
  })

  it("shows one next step in sparse sections", () => {
    renderCv("product")

    expect(
      screen.queryByRole("button", { name: EMPTY_SECTION_CTA.experience })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: EMPTY_SECTION_CTA.education })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: EMPTY_SECTION_CTA.skills })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /Add first / })
    ).not.toBeInTheDocument()
    expect(document.querySelector("[data-slot='empty']")).toBeNull()
    expect(document.querySelectorAll("[data-paper-section-cta]")).toHaveLength(
      0
    )
    expect(
      screen.getAllByRole("button", { name: "Add skill" }).length
    ).toBeLessThan(6)
  })

  it("shows the empty CTA on every template, not only internship", () => {
    for (const template of CV_TEMPLATES) {
      cleanup()
      renderCv(template.id, emptySections())
      expect(
        screen.getByRole("button", { name: EMPTY_SECTION_CTA.experience }),
        `${template.name} missing experience CTA`
      ).toBeInTheDocument()
      expect(
        screen.getByRole("button", { name: EMPTY_SECTION_CTA.education }),
        `${template.name} missing education CTA`
      ).toBeInTheDocument()
      expect(
        screen.getByRole("button", { name: EMPTY_SECTION_CTA.skills }),
        `${template.name} missing skills CTA`
      ).toBeInTheDocument()
    }
  })

  it("omits edit affordances from the print document", () => {
    render(
      createElement(CvDocument, {
        data: applyCvTemplate(defaultCvData(), "internship"),
        onChange: () => undefined,
      })
    )
    expect(screen.queryByRole("button", { name: "Add a line" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Add skill" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Duplicate role" })).toBeNull()
    cleanup()
    render(
      createElement(CvDocument, {
        data: emptySections(),
        onChange: () => undefined,
      })
    )
    expect(
      screen.queryByRole("button", { name: "Add first school" })
    ).toBeNull()
    expect(screen.queryByRole("button", { name: "Add a line" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Add skill" })).toBeNull()
  })

  it("prints filled projects and languages and skips empty sections", () => {
    const seed = {
      ...emptySections(),
      summary: "Shipped a small tool",
      projects: [{ name: "Wallet audit", detail: "Mapped friction" }],
      languages: ["Vietnamese"],
      activities: ["Debate club"],
      awards: ["Dean list"],
    } as CvData
    renderCv("internship", seed, false)
    const text = document.body.textContent ?? ""
    expect(text).toContain("Wallet audit")
    expect(text).toContain("Mapped friction")
    expect(text).toContain("Vietnamese")
    expect(text).toContain("Shipped a small tool")
    expect(text).toContain("Debate club")
    expect(text).toContain("Dean list")
    expect(text).not.toContain("Experience")
    expect(text).not.toContain("Education")
    expect(text).not.toContain("Add a line")
    for (const template of CV_TEMPLATES) {
      cleanup()
      renderCv(template.id, seed, false)
      expect(document.body.textContent ?? "", template.id).toContain(
        "Vietnamese"
      )
      expect(document.body.textContent ?? "", template.id).not.toContain(
        "Add skill"
      )
    }
  })
})

describe("empty section next-step CSS (QVE-209)", () => {
  it("stays visible without hover or Coach pills", () => {
    expect(paperCss).toMatch(/\.paper-canvas-next-step/)
    const start = paperCss.indexOf(".paper-canvas-next-step {")
    const end = paperCss.indexOf(".cv-a4-fit {")
    const chrome = paperCss.slice(start, end).replace(/\/\*[\s\S]*?\*\//g, "")
    expect(chrome).toContain("opacity: 1")
    expect(chrome).not.toMatch(/opacity:\s*0/)
    expect(chrome).not.toMatch(/var\(--info\)/)
    expect(chrome).not.toMatch(/rounded-full/)
    expect(chrome).not.toMatch(/bg-muted\/70/)
  })
})

describe("empty-field hints", () => {
  it("stay off for a share page or a thumbnail, and turn on only for the editor", () => {
    const quiet = {
      ...defaultCvData(),
      contact: { email: "", phone: "", location: "", linkedin: "" },
    }
    renderCv("internship", quiet, false)
    expect(screen.queryByRole("textbox", { name: "Email" })).toBeNull()
    cleanup()
    render(
      createElement(CvDocument, {
        data: { ...quiet, templateId: "internship" },
        onChange: () => undefined,
        placeholders: true,
      })
    )
    expect(screen.getByRole("textbox", { name: "Email" })).toBeInTheDocument()
  })
})

describe("CV templates split across cv-templates", () => {
  it.each(["internship", "photo", "product", "service", "academic"] as const)(
    "renders the %s template with the candidate name and an experience heading",
    (templateId) => {
      renderCv(templateId)
      expect(screen.getByRole("textbox", { name: "Name" })).toHaveTextContent(
        defaultCvData().name
      )
      expect(
        screen.getByText(/^(Work experience|Experience)$/)
      ).toBeInTheDocument()
    }
  )
})
