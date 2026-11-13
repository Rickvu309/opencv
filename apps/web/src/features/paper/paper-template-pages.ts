import type { PaperTemplateId } from "@workspace/domain"

import { PAPER_TEMPLATE_LABELS, previewTemplate } from "./paper-templates.ts"

export type TemplatePageLine = {
  readonly style: "Title" | "Heading1" | "ListBullet" | "Normal"
  readonly text: string
  readonly center?: true
}

type PageLayout = ReturnType<typeof previewTemplate>

type SectionKind =
  "summary" | "experience" | "education" | "skills" | "projects"

const LAYOUT_SECTIONS: Record<
  PageLayout,
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
  "with-photo": [
    ["summary", "Summary"],
    ["experience", "Experience"],
    ["education", "Education"],
    ["skills", "Skills"],
  ],
}

const SECTION_LINES: Record<SectionKind, readonly TemplatePageLine[]> = {
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

const HEADER_LINES: readonly TemplatePageLine[] = [
  { style: "Title", text: "[Your name]", center: true },
  { style: "Normal", text: "[Headline]", center: true },
  {
    style: "Normal",
    text: "[Email] | [Phone] | [City] | [LinkedIn]",
    center: true,
  },
]

export function templatePageLines(
  templateId: PaperTemplateId
): TemplatePageLine[] {
  return [
    ...HEADER_LINES,
    ...LAYOUT_SECTIONS[previewTemplate(templateId)].flatMap(([kind, title]) => [
      { style: "Heading1" as const, text: title },
      ...SECTION_LINES[kind],
    ]),
  ]
}

export const FEATURED_TEMPLATES: readonly PaperTemplateId[] = [
  "simple",
  "modern",
  "compact",
  "academic",
]

const TEMPLATE_USES: Record<string, string> = {
  simple: "Plain and safe for any role",
  modern: "Profile first, with selected work",
  compact: "Work experience leads",
  academic: "Education leads, for students",
}

export type TemplateChoice = {
  readonly id: PaperTemplateId
  readonly label: string
  readonly use: string
}

export const TEMPLATE_CHOICES: readonly TemplateChoice[] =
  FEATURED_TEMPLATES.map((id) => ({
    id,
    label: PAPER_TEMPLATE_LABELS.find((item) => item.id === id)?.label ?? id,
    use: TEMPLATE_USES[id] ?? "",
  }))

const words = (text: string) =>
  text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)

const headingsOf = (id: PaperTemplateId) =>
  templatePageLines(id)
    .filter((line) => line.style === "Heading1")
    .map((line) => line.text)
    .join(" ")

export function findTemplates(query: string): readonly TemplateChoice[] {
  const needles = words(query)
  if (needles.length === 0) return TEMPLATE_CHOICES
  return TEMPLATE_CHOICES.filter((choice) => {
    const haystack = words(
      `${choice.label} ${choice.use} ${headingsOf(choice.id)}`
    )
    return needles.every((needle) =>
      haystack.some((word) => word.startsWith(needle))
    )
  })
}
