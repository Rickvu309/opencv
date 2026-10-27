import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { emptyCvDocument, type CvDocument } from "./paper-codecs.ts"
import {
  blankBlockDocument,
  blocksToCvCodec,
  cvBlockDocumentSchema,
  cvCodecToBlocks,
  findImportChecks,
  readCvBlocks,
} from "./paper-blocks.ts"

function fixture(): CvDocument {
  return {
    templateId: "internship",
    name: "Linh Nguyen",
    headline: "Marketing student",
    contact: {
      email: "linh@example.com",
      phone: "0901234567",
      location: "Ho Chi Minh City",
      linkedin: "linkedin.com/in/linh",
    },
    summary: "Two lines of work.",
    experience: [
      {
        role: "Intern",
        company: "Lumiere",
        period: "Jun 2025 to now",
        bullets: ["Grew followers"],
      },
    ],
    education: [
      {
        school: "UEH",
        degree: "BBA",
        period: "2022 to 2026",
        detail: "GPA 3.6",
      },
    ],
    skills: [{ label: "Tools", items: ["Figma", "SQL"] }],
    projects: [{ name: "Campus app", detail: "Tested with 40 students" }],
    languages: ["English", "Vietnamese"],
  }
}

describe("cv block documents", () => {
  it("round-trips a codec fixture with one role, one school, and a skill group", () => {
    const source = fixture()
    const back = blocksToCvCodec(cvCodecToBlocks(source), "internship")
    assert.equal(back.name, source.name)
    assert.equal(back.headline, source.headline)
    assert.equal(back.summary, source.summary)
    assert.deepEqual(back.contact, source.contact)
    assert.deepEqual(back.experience, source.experience)
    assert.deepEqual(back.education, source.education)
    assert.deepEqual(back.skills[0]?.items, ["Figma", "SQL"])
    assert.deepEqual(back.projects, source.projects)
    assert.deepEqual(back.languages, source.languages)
    assert.equal(back.templateId, "internship")
  })

  it("accepts a version 2 document", () => {
    const parsed = cvBlockDocumentSchema.safeParse(blankBlockDocument())
    assert.equal(parsed.success, true)
  })

  it("opens an empty v1 codec as the blank block document", () => {
    const blocks = readCvBlocks(emptyCvDocument())
    assert.equal(blocks?.version, 2)
    assert.equal(blocks?.header.name, "")
    assert.equal(blocks?.sections[0]?.kind, "experience")
    const first = blocks?.sections[0]?.blocks[0]
    assert.equal(first?.type, "heading")
    assert.equal(first && "text" in first ? first.text : "missing", "")
  })

  it("raises a phone check when the header phone is empty", () => {
    const document = blankBlockDocument()
    const checks = findImportChecks(document)
    assert.equal(
      checks.some((check) => check.kind === "phone"),
      true
    )
    assert.equal(
      checks.find((check) => check.kind === "phone")?.message,
      "No phone number in your file."
    )
  })

  it("raises a dates check for Recently and not for Jun 2025 to now", () => {
    const recent = blankBlockDocument()
    recent.sections[0]?.blocks.splice(1, 1, {
      id: "block-dates",
      type: "text",
      text: "Recently",
    })
    assert.equal(
      findImportChecks(recent).some((check) => check.kind === "dates"),
      true
    )

    const dated = blankBlockDocument()
    dated.sections[0]?.blocks.splice(1, 1, {
      id: "block-dates",
      type: "text",
      text: "Jun 2025 to now",
    })
    assert.equal(
      findImportChecks(dated).some((check) => check.kind === "dates"),
      false
    )
  })
})
