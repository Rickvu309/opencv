import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  decodePaperContent,
  emptyCvDocument,
  type CvDocument,
} from "./paper-codecs.ts"
import {
  paperCheckSchema,
  storedPaperDocumentSchema,
} from "./paper-contract.ts"
import {
  BLOCK_TYPES,
  blankBlockDocument,
  blockRegistry,
  blocksToCvCodec,
  blocksToPreviewModel,
  cvCodecToBlocks,
  findImportChecks,
  hasPhoneRun,
  paragraphsToBlockDocument,
  readCvBlocks,
  unreadableImportLink,
  type CvBlockDocument,
} from "./paper-blocks/index.ts"

function sampleCv(): CvDocument {
  return {
    templateId: "internship",
    name: "Lan Nguyen",
    headline: "Product intern",
    contact: {
      email: "lan@example.com",
      phone: "+84 912 345 678",
      location: "Hanoi",
      linkedin: "linkedin.com/in/lan",
    },
    summary: "Ships small experiments.",
    experience: [
      {
        role: "Discovery lead",
        company: "UIT Product Club",
        period: "2024 – Present",
        bullets: ["Ran interviews"],
      },
    ],
    education: [
      {
        school: "UIT",
        degree: "B.Sc. Information Systems",
        period: "2022 – 2026",
        detail: "HCI",
      },
    ],
    skills: [{ label: "Product", items: ["Interviews", "PRDs"] }],
    projects: [{ name: "Wallet audit", detail: "Mapped friction" }],
    languages: ["Vietnamese", "English"],
  }
}

function textDocument(text: string, phone = ""): CvBlockDocument {
  return {
    version: 2,
    header: { name: "", email: "", phone, city: "", linkedin: "" },
    sections: [
      {
        id: "section-summary",
        kind: "summary",
        blocks: [{ id: "note", type: "text", text }],
      },
    ],
  }
}

describe("block registry", () => {
  it("walks every entry for schema, empty, print, plainText and turnInto", () => {
    assert.deepEqual(BLOCK_TYPES, [
      "text",
      "heading",
      "bulleted-list",
      "numbered-list",
      "divider",
      "experience-entry",
      "education-entry",
      "skills-group",
    ])
    const known = new Set<string>(BLOCK_TYPES)
    for (const entry of blockRegistry) {
      assert.equal(typeof entry.schema.safeParse, "function", entry.type)
      assert.equal(typeof entry.empty, "function", entry.type)
      assert.equal(typeof entry.print, "function", entry.type)
      assert.equal(typeof entry.plainText, "function", entry.type)
      assert.ok(Array.isArray(entry.turnInto), entry.type)
      const blank = entry.empty()
      assert.equal(entry.schema.safeParse(blank).success, true, entry.type)
      assert.equal(typeof entry.plainText(blank), "string")
      assert.equal(typeof entry.print(blank).kind, "string")
      for (const target of entry.turnInto) {
        assert.equal(known.has(target), true, `${entry.type} -> ${target}`)
      }
      if (entry.slash) {
        assert.ok(entry.slash.label.trim().length > 0, entry.type)
        assert.equal(entry.slash.group, "blocks")
      }
    }
    const offered = blockRegistry
      .filter((entry) => entry.slash)
      .map((entry) => entry.type)
    assert.deepEqual(offered, [
      "text",
      "heading",
      "bulleted-list",
      "numbered-list",
      "divider",
    ])
  })
})

describe("cv block codec", () => {
  it("round-trips a v1 fixture, including the skills label", () => {
    const fixture = sampleCv()
    const blocks = cvCodecToBlocks(fixture)
    const experience = blocks.sections.find(
      (section) => section.kind === "experience"
    )
    assert.equal(experience?.blocks.length, 1)
    assert.equal(experience?.blocks[0]?.type, "experience-entry")
    assert.deepEqual(blocksToCvCodec(blocks, fixture.templateId), fixture)
  })

  it("keeps the first skills label when groups merge into one block", () => {
    const fixture = sampleCv()
    fixture.skills = [
      { label: "Product", items: ["PRDs"] },
      { label: "Tools", items: ["Figma"] },
    ]
    const back = blocksToCvCodec(cvCodecToBlocks(fixture), fixture.templateId)
    assert.deepEqual(back.skills, [
      { label: "Product", items: ["PRDs", "Figma"] },
    ])
  })

  it("stores no block for an empty headline", () => {
    const fixture = sampleCv()
    fixture.headline = ""
    fixture.summary = "Only the summary."
    const blocks = cvCodecToBlocks(fixture)
    const summary = blocks.sections.find(
      (section) => section.kind === "summary"
    )
    assert.ok(summary)
    assert.equal(
      summary.blocks.some((block) => block.type === "heading"),
      false
    )
    assert.equal(summary.blocks.length, 1)
    const back = blocksToCvCodec(blocks, fixture.templateId)
    assert.equal(back.headline, "")
    assert.equal(back.summary, "Only the summary.")
  })

  it("maps a plain experience block to a bullet, or to a role when no entry exists", () => {
    const document: CvBlockDocument = {
      version: 2,
      header: {
        name: "Lan Nguyen",
        email: "",
        phone: "",
        city: "",
        linkedin: "",
      },
      sections: [
        {
          id: "section-experience",
          kind: "experience",
          blocks: [
            { id: "note", type: "text", text: "Notes before a role" },
            {
              id: "role",
              type: "experience-entry",
              role: "Discovery lead",
              company: "UIT Product Club",
              period: "2024",
              bullets: [],
            },
            { id: "under", type: "text", text: "Typed under the entry" },
          ],
        },
      ],
    }
    assert.deepEqual(blocksToCvCodec(document).experience, [
      {
        role: "Notes before a role",
        company: "",
        period: "",
        bullets: [],
      },
      {
        role: "Discovery lead",
        company: "UIT Product Club",
        period: "2024",
        bullets: ["Typed under the entry"],
      },
    ])
  })

  it("puts activities and awards on the preview model", () => {
    const blocks = cvCodecToBlocks(sampleCv())
    blocks.sections.push(
      {
        id: "section-activities",
        kind: "activities",
        blocks: [{ id: "club", type: "text", text: "Product club" }],
      },
      {
        id: "section-awards",
        kind: "awards",
        blocks: [{ id: "award", type: "heading", text: "Dean list" }],
      }
    )
    const preview = blocksToPreviewModel(blocks, "internship")
    assert.deepEqual(preview.activities, ["Product club"])
    assert.deepEqual(preview.awards, ["Dean list"])
    assert.equal(preview.experience[0]?.role, "Discovery lead")
  })

  it("reads a slash-inserted project from its text block", () => {
    const projects = (
      blocks: CvBlockDocument["sections"][number]["blocks"]
    ): CvBlockDocument => ({
      version: 2,
      header: {
        name: "Lan Nguyen",
        email: "",
        phone: "",
        city: "",
        linkedin: "",
      },
      sections: [{ id: "section-projects", kind: "projects", blocks }],
    })
    assert.deepEqual(
      blocksToPreviewModel(
        projects([{ id: "note", type: "text", text: "OpenCV\nA CV editor" }])
      ).projects,
      [{ name: "OpenCV", detail: "A CV editor" }]
    )
    assert.deepEqual(
      blocksToPreviewModel(
        projects([{ id: "name-only", type: "text", text: "OpenCV project" }])
      ).projects,
      [{ name: "OpenCV project", detail: "" }]
    )
    assert.deepEqual(
      blocksToPreviewModel(
        projects([
          { id: "name", type: "heading", text: "Wallet audit" },
          { id: "detail", type: "text", text: "Mapped friction" },
        ])
      ).projects,
      [{ name: "Wallet audit", detail: "Mapped friction" }]
    )
    assert.deepEqual(
      blocksToPreviewModel(
        projects([
          { id: "name", type: "heading", text: "Wallet audit" },
          { id: "detail", type: "text", text: "Mapped friction" },
          {
            id: "points",
            type: "bulleted-list",
            items: [{ id: "point", text: "Interviewed five people" }],
          },
        ])
      ).projects,
      [
        {
          name: "Wallet audit",
          detail: "Mapped friction\nInterviewed five people",
        },
      ]
    )
  })
})

describe("import checks", () => {
  it("does not treat 2019-2024 as a phone, and a real number satisfies the check", () => {
    assert.equal(hasPhoneRun("2019-2024"), false)
    assert.equal(hasPhoneRun("+84 912 345 678"), true)
    const yearOnly = textDocument("Worked 2019-2024")
    assert.equal(
      findImportChecks(yearOnly).some((check) => check.kind === "phone"),
      true
    )
    const satisfied = textDocument("Call +84 912 345 678")
    assert.equal(
      findImportChecks(satisfied).some((check) => check.kind === "phone"),
      false
    )
  })

  it("raises dates for Recently and not for a year in the period", () => {
    const role = (period: string): CvBlockDocument => ({
      version: 2,
      header: {
        name: "Lan",
        email: "",
        phone: "+84 912 345 678",
        city: "",
        linkedin: "",
      },
      sections: [
        {
          id: "section-experience",
          kind: "experience",
          blocks: [
            {
              id: "role",
              type: "experience-entry",
              role: "Lead",
              company: "UIT",
              period,
              bullets: [],
            },
          ],
        },
      ],
    })
    assert.equal(
      findImportChecks(role("Recently")).some(
        (check) => check.kind === "dates"
      ),
      true
    )
    assert.equal(
      findImportChecks(role("Jun 2025 to now")).some(
        (check) => check.kind === "dates"
      ),
      false
    )
    assert.equal(
      findImportChecks(role("2019-2024")).some(
        (check) => check.kind === "dates"
      ),
      false
    )
  })

  it("refuses Google Docs and LinkedIn links and wraps paragraphs", () => {
    assert.equal(
      unreadableImportLink("https://docs.google.com/document/d/abc"),
      "Google Docs aren't supported. Download a PDF or Word file."
    )
    assert.equal(
      unreadableImportLink("https://www.linkedin.com/in/example"),
      "LinkedIn links aren't supported. Download a PDF or Word file."
    )
    assert.equal(unreadableImportLink("https://example.com/cv"), null)
    const wrapped = paragraphsToBlockDocument("First line\n\nSecond line")
    assert.equal(wrapped.sections[0]?.blocks.length, 2)
    assert.equal(wrapped.version, 2)
  })
})

describe("stored cv documents", () => {
  it("accepts v1 and version 2 and rejects version 3", () => {
    const v2 = blankBlockDocument()
    assert.deepEqual(decodePaperContent("cv", 1, emptyCvDocument()), {
      ok: true,
      data: emptyCvDocument(),
    })
    assert.deepEqual(decodePaperContent("cv", 1, v2), { ok: true, data: v2 })
    const rejected = decodePaperContent("cv", 1, { version: 3 })
    assert.equal(rejected.ok, false)
    if (rejected.ok) return
    assert.notEqual(rejected.message, "Unsupported content version")
    assert.ok(rejected.message.length > 0)
    assert.equal(storedPaperDocumentSchema.safeParse(v2).success, true)
    assert.equal(
      storedPaperDocumentSchema.safeParse(emptyCvDocument()).success,
      true
    )
    assert.equal(
      storedPaperDocumentSchema.safeParse({ version: 3 }).success,
      false
    )
    assert.equal(
      paperCheckSchema.safeParse({
        id: "phone",
        kind: "phone",
        message: "No phone number in your file.",
        blockId: "header.phone",
        resolved: false,
      }).success,
      true
    )
    assert.equal(
      paperCheckSchema.safeParse({
        id: "import",
        kind: "import",
        message: "Imported file needs a read.",
      }).success,
      true
    )
  })

  it("reads a blank v1 document as the blank version 2 document", () => {
    assert.deepEqual(readCvBlocks(emptyCvDocument()), blankBlockDocument())
    const filled = cvCodecToBlocks(sampleCv())
    assert.equal(readCvBlocks(filled), filled)
  })
})
