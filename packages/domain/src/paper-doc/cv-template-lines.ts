import type { PaperTemplateId } from "./paper.js"

type TemplateStyle = "Title" | "Heading1" | "ListBullet" | "Normal"

export type TemplateLine = {
  readonly style: TemplateStyle
  readonly text: string
  readonly center?: true
}

type SectionKind =
  "summary" | "experience" | "education" | "skills" | "projects"

type TemplateLayout = "simple" | "modern" | "compact" | "academic" | "photo"

const LAYOUT_SECTIONS: Record<
  TemplateLayout,
  readonly (readonly [SectionKind, string])[]
> = {
  simple: [
    ["summary", "Summary"],
    ["experience", "Experience"],
    ["education", "Education"],
    ["skills", "Skills"],
  ],
  modern: [
    ["summary", "Profile"],
    ["experience", "Experience"],
    ["projects", "Selected work"],
  ],
  compact: [
    ["experience", "Work experience"],
    ["summary", "About"],
    ["education", "Education"],
    ["skills", "Skills"],
  ],
  academic: [
    ["education", "Education"],
    ["projects", "Projects & campus"],
    ["experience", "Experience"],
    ["skills", "Skills & languages"],
  ],
  photo: [
    ["summary", "Summary"],
    ["experience", "Experience"],
    ["education", "Education"],
    ["skills", "Skills"],
  ],
}

const SECTION_LINES: Record<SectionKind, readonly TemplateLine[]> = {
  summary: [
    {
      style: "Normal",
      text: "[Two or three lines on who you are and the work you want]",
    },
  ],
  experience: [
    { style: "Normal", text: "[Role, company] | [Dates]" },
    {
      style: "ListBullet",
      text: "[What you did, and what changed because of it]",
    },
  ],
  education: [
    { style: "Normal", text: "[School, degree] | [Dates]" },
    { style: "ListBullet", text: "[A course, result or project worth naming]" },
  ],
  skills: [{ style: "Normal", text: "[Tools, software and languages]" }],
  projects: [
    { style: "Normal", text: "[Project or role] | [Dates]" },
    {
      style: "ListBullet",
      text: "[What you made, and what changed because of it]",
    },
  ],
}

const HEADER_LINES: readonly TemplateLine[] = [
  { style: "Title", text: "[Your name]", center: true },
  { style: "Normal", text: "[Headline]", center: true },
  {
    style: "Normal",
    text: "[Email] | [Phone] | [City] | [LinkedIn]",
    center: true,
  },
]

function layoutOf(templateId: PaperTemplateId): TemplateLayout {
  switch (templateId) {
    case "modern":
      return "modern"
    case "compact":
      return "compact"
    case "academic":
      return "academic"
    case "with-photo":
      return "photo"
    default:
      return "simple"
  }
}

export function templateLines(templateId: PaperTemplateId): TemplateLine[] {
  return [
    ...HEADER_LINES,
    ...LAYOUT_SECTIONS[layoutOf(templateId)].flatMap(([kind, title]) => [
      { style: "Heading1" as const, text: title },
      ...SECTION_LINES[kind],
    ]),
  ]
}

function templateLabel(templateId: PaperTemplateId) {
  if (templateId === "with-photo") return "With photo"
  if (templateId === "two-column") return "Two column"
  return templateId.charAt(0).toUpperCase() + templateId.slice(1)
}

export function templatePageName(templateId: PaperTemplateId) {
  return `${templateLabel(templateId)} CV`
}
