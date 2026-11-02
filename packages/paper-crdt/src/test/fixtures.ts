import {
  blankCv,
  blankLetter,
  emptyCvDocument,
  paperDocumentSchema,
  upgradeStoredPaper,
  type PaperDocument,
} from "@workspace/domain"

function parsed(candidate: unknown): PaperDocument {
  return paperDocumentSchema.parse(candidate)
}

export const richCv = parsed({
  version: 3,
  kind: "cv",
  header: {
    id: "header",
    type: "header",
    name: "Ada Lovelace",
    email: "ada@example.com",
    phone: "+44 20 7946 0000",
    city: "London",
    linkedin: "linkedin.com/in/ada",
    photo: "file:6f1d3c1e-0a53-4b8e-9d57-2f5c4f0f7a11",
  },
  blocks: [
    { id: "s-sum", type: "section", kind: "summary", title: "Summary" },
    {
      id: "p1",
      type: "paragraph",
      content: [
        { text: "Wrote the " },
        { text: "first", bold: true },
        { text: " ", italic: true },
        { text: "program", bold: true, italic: true },
        { text: " for the engine, see " },
        { text: "notes", href: "https://example.com/notes" },
        { text: " and ", href: "https://example.com/notes", bold: true },
        { text: " then line one\nline two" },
      ],
    },
    { id: "h2", type: "heading", level: 2, content: "Highlights" },
    {
      id: "h3",
      type: "heading",
      level: 3,
      content: [{ text: "Small", italic: true }],
    },
    { id: "d1", type: "divider" },
    { id: "s-exp", type: "section", kind: "experience", title: "Experience" },
    {
      id: "x1",
      type: "experience",
      role: "Analyst",
      company: "Babbage & Co",
      period: "1842 – 1843",
      location: "London",
      children: [
        {
          id: "x1a",
          type: "bullet",
          content: "Wrote the first program for the engine",
          children: [
            {
              id: "x1a1",
              type: "numbered",
              content: [{ text: "Nested", bold: true }],
              children: [
                {
                  id: "x1a1a",
                  type: "bullet",
                  content: "Deepest",
                  children: [],
                },
              ],
            },
          ],
        },
        { id: "x1b", type: "numbered", content: "", children: [] },
      ],
    },
    { id: "s-edu", type: "section", kind: "education", title: "Education" },
    {
      id: "e1",
      type: "education",
      school: "Home tuition",
      degree: "Mathematics",
      period: "1829",
      detail: "",
      children: [
        {
          id: "e1a",
          type: "bullet",
          content: "Taught by De Morgan",
          children: [],
        },
      ],
    },
    { id: "s-skills", type: "section", kind: "skills", title: "Skills" },
    {
      id: "k1",
      type: "skills",
      label: "Maths",
      items: ["Calculus", "Analysis"],
    },
    { id: "k2", type: "skills", label: "", items: [] },
    { id: "b1", type: "bullet", content: "Loose bullet", children: [] },
    { id: "n1", type: "numbered", content: "Loose numbered", children: [] },
  ],
  clashes: [],
})

export const richLetter = parsed({
  version: 3,
  kind: "letter",
  blocks: [
    { id: "l1", type: "paragraph", content: "Dear team," },
    { id: "l2", type: "heading", level: 2, content: "Why me" },
    {
      id: "l3",
      type: "bullet",
      content: [
        { text: "Shipped " },
        { text: "fast", bold: true },
        { text: " and " },
        { text: "wrote", href: "mailto:ada@example.com" },
      ],
      children: [],
    },
    { id: "l4", type: "divider" },
    { id: "l5", type: "paragraph", content: "" },
  ],
  clashes: [],
})

const storedCv = {
  ...emptyCvDocument(),
  name: "Lan Nguyen",
  headline: "Product intern",
  contact: {
    email: "lan@example.com",
    phone: "+84 912",
    location: "Hanoi",
    linkedin: "",
  },
  summary: "Ships small experiments.",
  experience: [
    {
      role: "Discovery lead",
      company: "UIT Product Club",
      period: "2024 – Present",
      bullets: ["Ran interviews", "Wrote the PRD"],
    },
  ],
  education: [
    { school: "UIT", degree: "B.Sc.", period: "2022 – 2026", detail: "HCI" },
  ],
  skills: [{ label: "Tools", items: ["Figma", "SQL basics"] }],
}

function upgraded(kind: "cv" | "letter", stored: unknown): PaperDocument {
  const result = upgradeStoredPaper(kind, stored)
  if (!result.ok) throw new Error(result.message)
  return result.document
}

export const v3Fixtures: Record<string, PaperDocument> = {
  richCv,
  richLetter,
  blankCv: parsed(blankCv()),
  blankLetter: parsed(blankLetter()),
  upgradedCv: upgraded("cv", storedCv),
  upgradedLetter: upgraded("letter", {
    markdown: "Dear team,\n\nI **build** things.\n\n- one\n- two\n\nBest,\nLan",
  }),
}
