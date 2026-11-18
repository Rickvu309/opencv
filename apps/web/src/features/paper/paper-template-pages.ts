import type { PaperTemplateId } from "@workspace/domain"

import { PAPER_TEMPLATE_LABELS, previewTemplate } from "./paper-templates.ts"

export type TemplatePageLine = {
  readonly style: "Title" | "Heading1" | "Entry" | "Label" | "Normal"
  readonly text: string
  readonly aside?: string
  readonly label?: string
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

const entry = (
  place: string,
  where: string,
  role: string,
  when: string,
  detail: string
): TemplatePageLine[] => [
  { style: "Entry", text: place, aside: where },
  { style: "Entry", text: role, aside: when },
  { style: "Normal", text: detail },
]

const EXAMPLE_SECTIONS: Record<SectionKind, readonly TemplatePageLine[]> = {
  summary: [
    {
      style: "Normal",
      text: "Marketing student who turns customer research into campaigns people remember. Ran surveys and focus groups with over 500 responses and presented the findings to senior managers. Looking for a first full-time role in brand marketing.",
    },
  ],
  experience: [
    ...entry(
      "Lumiere Beverages Vietnam",
      "Ho Chi Minh City",
      "Marketing Analyst Intern",
      "May - August 2026",
      "Examined demand for a new fruit drink by comparing similar brands. Managed focus groups and surveys that gathered over 500 responses. Presented the findings to senior managers with clear charts and a launch plan."
    ),
    ...entry(
      "Saigon Bright Communications",
      "Remote",
      "Assistant Account Executive",
      "June - August 2025",
      "Researched and assembled proposals for public relations clients. Drafted client letters and joined weekly planning sessions with the account team."
    ),
  ],
  education: [
    ...entry(
      "RMIT University Vietnam",
      "Ho Chi Minh City",
      "Bachelor of Business in Marketing, GPA 3.7",
      "May 2027",
      "Relevant coursework: Consumer Behaviour, Market Research and Digital Marketing."
    ),
    ...entry(
      "University of Melbourne",
      "Melbourne, Australia",
      "Exchange semester in Marketing Analytics",
      "February - June 2025",
      "Studied customer data analysis and brand strategy with students from 20 countries."
    ),
  ],
  projects: [
    ...entry(
      "RMIT Women in Business",
      "Ho Chi Minh City",
      "Executive Committee Member",
      "February 2024 - Present",
      "Organized a membership campaign and a business conference for 50 professionals and 500 students."
    ),
    ...entry(
      "Campus Charity Run",
      "Ho Chi Minh City",
      "Training Program Director",
      "January - May 2024",
      "Built a training plan for 25 runners and raised over 25,000 USD for a local food bank."
    ),
  ],
  skills: [
    {
      style: "Label",
      label: "Technical:",
      text: "Excel, SQL, Google Analytics, Canva.",
    },
    {
      style: "Label",
      label: "Languages:",
      text: "Vietnamese (native), English (fluent), French (conversational).",
    },
    {
      style: "Label",
      label: "Interests:",
      text: "Street photography, badminton and Vietnamese cinema.",
    },
  ],
}

const EXAMPLE_HEADER: readonly TemplatePageLine[] = [
  { style: "Title", text: "Linh Nguyen", center: true },
  {
    style: "Normal",
    text: "Ho Chi Minh City \u2022 linh.nguyen@example.com \u2022 +84 912 345 678",
    center: true,
  },
]

export function templatePageLines(
  templateId: PaperTemplateId
): TemplatePageLine[] {
  return [
    ...EXAMPLE_HEADER,
    ...LAYOUT_SECTIONS[previewTemplate(templateId)].flatMap(([kind, title]) => [
      { style: "Heading1" as const, text: title },
      ...EXAMPLE_SECTIONS[kind],
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
