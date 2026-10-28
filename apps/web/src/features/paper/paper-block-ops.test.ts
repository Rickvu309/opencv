import { describe, expect, it } from "vitest"
import {
  emptyCvDocument,
  type CvBlock,
  type CvBlockDocument,
  type CvSectionKind,
} from "@workspace/domain"

import { dropBlock } from "./paper-block-drop.ts"
import { deleteBlock, readEditorDocument } from "./paper-block-ops.ts"

const document: CvBlockDocument = {
  version: 2,
  header: { name: "", email: "", phone: "", city: "", linkedin: "" },
  sections: [
    {
      id: "summary",
      kind: "summary",
      blocks: [{ id: "sum", type: "text", text: "Line" }],
    },
    {
      id: "experience",
      kind: "experience",
      blocks: [{ id: "role", type: "text", text: "Role" }],
    },
  ],
}

describe("block ops", () => {
  it("removes a non-starter section when its last block goes", () => {
    const next = deleteBlock(document, "sum")
    expect(next.sections.map((section) => section.kind)).toEqual(["experience"])
  })

  it("keeps an empty experience section", () => {
    const next = deleteBlock(document, "role")
    expect(next.sections.map((section) => section.kind)).toEqual([
      "summary",
      "experience",
    ])
    expect(next.sections[1]?.blocks).toEqual([])
  })

  it("moves a block onto another section", () => {
    const next = dropBlock(document, "role", "section:summary")
    expect(next.sections[0]?.blocks.map((block) => block.id)).toEqual([
      "sum",
      "role",
    ])
  })

  it("reads a version 1 CV as version 2", () => {
    const next = readEditorDocument(emptyCvDocument())
    expect(next.version).toBe(2)
    expect(next.header.name).toBe("")
  })
})

const expA: CvBlock = {
  id: "exp-a",
  type: "experience-entry",
  role: "First role",
  company: "Northwind",
  period: "2020",
  bullets: [],
}
const expB: CvBlock = {
  id: "exp-b",
  type: "experience-entry",
  role: "Second role",
  company: "Contoso",
  period: "2022",
  bullets: [],
}
const edu: CvBlock = {
  id: "edu-1",
  type: "education-entry",
  school: "State",
  degree: "BSc",
  period: "2019",
  detail: "Honors",
}
const skill: CvBlock = {
  id: "skill-1",
  type: "skills-group",
  label: "Tools",
  items: ["TypeScript"],
}

const header = { name: "Ada", email: "", phone: "", city: "", linkedin: "" }

function threeSections(educationBlocks: CvBlock[]): CvBlockDocument {
  return {
    version: 2,
    header,
    sections: [
      { id: "section-experience", kind: "experience", blocks: [expA, expB] },
      { id: "section-education", kind: "education", blocks: educationBlocks },
      { id: "section-skills", kind: "skills", blocks: [skill] },
    ],
  }
}

describe("drop on a section heading", () => {
  it("appends the block and keeps every other block, one result per heading", () => {
    const commits: CvBlockDocument[] = []
    let next = threeSections([edu])
    for (const sectionId of [
      "section-experience",
      "section-education",
      "section-skills",
    ]) {
      const dropped = dropBlock(next, "exp-b", `section:${sectionId}`)
      // exp-b is already last under Experience, so that drop does not commit.
      if (sectionId === "section-experience") expect(dropped).toBe(next)
      else expect(dropped).not.toBe(next)
      commits.push(dropped)
      next = dropped
    }
    expect(commits).toHaveLength(3)
    expect(commits[0]).toEqual(threeSections([edu]))
    expect(commits[1]?.sections).toEqual([
      { id: "section-experience", kind: "experience", blocks: [expA] },
      { id: "section-education", kind: "education", blocks: [edu, expB] },
      { id: "section-skills", kind: "skills", blocks: [skill] },
    ])
    expect(commits[2]?.sections).toEqual([
      { id: "section-experience", kind: "experience", blocks: [expA] },
      { id: "section-education", kind: "education", blocks: [edu] },
      {
        id: "section-skills",
        kind: "skills",
        blocks: [skill, expB],
      },
    ])
    expect(commits[2]?.header).toEqual(header)
    expect(commits[2]?.version).toBe(2)
  })

  it("keeps the on-screen starter when the heading's section has no stored blocks", () => {
    const next = dropBlock(
      threeSections([]),
      "exp-b",
      "section:section-education"
    )
    expect(next.sections).toEqual([
      { id: "section-experience", kind: "experience", blocks: [expA] },
      {
        id: "section-education",
        kind: "education",
        blocks: [
          {
            id: "draft-section-education",
            type: "education-entry",
            school: "",
            degree: "",
            period: "",
            detail: "",
          },
          expB,
        ],
      },
      { id: "section-skills", kind: "skills", blocks: [skill] },
    ])
    const onStarter = dropBlock(
      threeSections([]),
      "exp-b",
      "draft-section-education"
    )
    expect(onStarter.sections).toEqual(next.sections)
  })

  it("keeps a starter when a missing section heading receives a block", () => {
    const source = threeSections([edu])
    const withoutSkills = {
      ...source,
      sections: source.sections.filter((section) => section.kind !== "skills"),
    }
    const next = dropBlock(withoutSkills, "exp-b", "section:ghost-skills")
    const skills = next.sections.find((section) => section.kind === "skills")
    expect(skills?.blocks.map((block) => block.type)).toEqual([
      "skills-group",
      "experience-entry",
    ])
    expect(skills?.blocks[1]).toEqual(expB)
    expect(
      next.sections.find((section) => section.id === "section-education")
        ?.blocks
    ).toEqual([edu])
    expect(
      next.sections.find((section) => section.id === "section-experience")
        ?.blocks
    ).toEqual([expA])
  })
})

const sectionKinds = [
  "summary",
  "experience",
  "education",
  "skills",
  "projects",
  "activities",
  "awards",
  "languages",
] as const satisfies readonly CvSectionKind[]

const keeperKinds = ["experience", "education", "skills"] as const

function textBlock(id: string, text: string): CvBlock {
  return { id, type: "text", text }
}

function sectionDocument(
  sections: CvBlockDocument["sections"]
): CvBlockDocument {
  return { version: 2, header, sections }
}

describe("drop on every section kind", () => {
  it.each(sectionKinds)("appends onto a non-empty %s section", (kind) => {
    const sourceKind = kind === "experience" ? "projects" : "experience"
    const source = sectionDocument([
      {
        id: "section-source",
        kind: sourceKind,
        blocks: [expB],
      },
      {
        id: `section-${kind}`,
        kind,
        blocks: [textBlock(`stay-${kind}`, "Stay")],
      },
    ])
    const next = dropBlock(source, "exp-b", `section:section-${kind}`)
    expect(
      next.sections
        .find((section) => section.kind === kind)
        ?.blocks.map((block) => block.id)
    ).toEqual([`stay-${kind}`, "exp-b"])
    const leftover = next.sections.find(
      (section) => section.id === "section-source"
    )
    if (sourceKind === "experience") {
      expect(leftover?.blocks).toEqual([])
    } else {
      expect(leftover).toBeUndefined()
    }
  })

  it.each(keeperKinds)(
    "keeps the starter when a block drops onto an empty %s heading",
    (kind) => {
      const source = sectionDocument([
        { id: "section-projects", kind: "projects", blocks: [expB] },
        { id: `section-${kind}`, kind, blocks: [] },
      ])
      const next = dropBlock(source, "exp-b", `section:section-${kind}`)
      const target = next.sections.find((section) => section.kind === kind)
      const starter =
        kind === "skills"
          ? {
              id: `draft-section-${kind}`,
              type: "skills-group" as const,
              label: "",
              items: [],
            }
          : kind === "education"
            ? {
                id: `draft-section-${kind}`,
                type: "education-entry" as const,
                school: "",
                degree: "",
                period: "",
                detail: "",
              }
            : {
                id: `draft-section-${kind}`,
                type: "experience-entry" as const,
                role: "",
                company: "",
                period: "",
                bullets: [],
              }
      expect(target?.blocks).toEqual([starter, expB])
      expect(
        next.sections.find((section) => section.kind === "projects")
      ).toBeUndefined()
      const onStarter = dropBlock(source, "exp-b", `draft-section-${kind}`)
      expect(onStarter.sections).toEqual(next.sections)
    }
  )

  it.each(sectionKinds)(
    "keeps a one-block %s section dropped onto its own heading",
    (kind) => {
      const block = textBlock(`only-${kind}`, "Only")
      const source = sectionDocument([
        { id: `section-${kind}`, kind, blocks: [block] },
      ])
      const next = dropBlock(source, block.id, `section:section-${kind}`)
      expect(next).toBe(source)
    }
  )

  it("moves an earlier block to the end of its own section", () => {
    const source = sectionDocument([
      {
        id: "section-projects",
        kind: "projects",
        blocks: [textBlock("a", "A"), textBlock("b", "B")],
      },
    ])
    const next = dropBlock(source, "a", "section:section-projects")
    expect(next.sections[0]?.blocks.map((block) => block.id)).toEqual([
      "b",
      "a",
    ])
  })
})
