import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  BLOCK_TYPES,
  blankBlockDocument,
  blockEntry,
  blockRegistry,
  blocksToCvCodec,
  blocksToPreviewModel,
  cvBlockSchema,
  cvBlockSchemaFrom,
  cvCodecToBlocks,
  decodePaperContent,
  emptyCvDocument,
  mergeCodecIntoBlocks,
  previewToCvDocument,
  type CvBlockDocument,
  type CvDocument,
} from "./index.ts"

function richDocument(): CvBlockDocument {
  return {
    version: 2,
    header: {
      name: "Ada Verify",
      email: "ada@example.com",
      phone: "1",
      city: "Hanoi",
      linkedin: "",
    },
    sections: [
      {
        id: "sec-summary",
        kind: "summary",
        blocks: [
          { id: "head-1", type: "heading", text: "Discovery lead" },
          { id: "sum-1", type: "text", text: "Ships interview notes." },
          { id: "div-1", type: "divider" },
          {
            id: "num-1",
            type: "numbered-list",
            items: [{ id: "step-1", text: "Step one" }],
          },
        ],
      },
      {
        id: "sec-exp",
        kind: "experience",
        blocks: [
          {
            id: "role-1",
            type: "experience-entry",
            role: "Discovery lead",
            company: "UIT",
            period: "2024",
            location: "Hanoi",
            bullets: [{ id: "bullet-1", text: "Ran interviews" }],
          },
        ],
      },
      {
        id: "sec-skills",
        kind: "skills",
        blocks: [
          {
            id: "skill-1",
            type: "skills-group",
            label: "Interviews",
            items: ["Notes"],
          },
          {
            id: "skill-2",
            type: "skills-group",
            label: "PRDs",
            items: ["Specs"],
          },
        ],
      },
      {
        id: "sec-act",
        kind: "activities",
        blocks: [{ id: "act-1", type: "text", text: "Debate club" }],
      },
      {
        id: "sec-aw",
        kind: "awards",
        blocks: [{ id: "aw-1", type: "text", text: "Dean list" }],
      },
    ],
  }
}

describe("mergeCodecIntoBlocks", () => {
  it("keeps version 2, ids, and the sections the form cannot hold", () => {
    const stored = richDocument()
    const edited = previewToCvDocument(
      blocksToPreviewModel(stored, "internship")
    )
    edited.summary = "Ships interview notes.X"
    const merged = mergeCodecIntoBlocks(stored, edited)
    assert.equal(merged.version, 2)
    const summary = merged.sections.find(
      (section) => section.id === "sec-summary"
    )
    assert.ok(summary)
    assert.equal(
      summary.blocks.find(
        (block) => block.id === "sum-1" && block.type === "text"
      )?.text,
      "Ships interview notes.X"
    )
    assert.equal(
      summary.blocks.some(
        (block) => block.id === "div-1" && block.type === "divider"
      ),
      true
    )
    assert.equal(
      summary.blocks.some(
        (block) => block.id === "num-1" && block.type === "numbered-list"
      ),
      true
    )
    const experience = merged.sections.find(
      (section) => section.id === "sec-exp"
    )
    const role = experience?.blocks.find((block) => block.id === "role-1")
    assert.equal(role?.type, "experience-entry")
    if (role?.type === "experience-entry") assert.equal(role.location, "Hanoi")
    const skills = merged.sections.find(
      (section) => section.id === "sec-skills"
    )
    assert.deepEqual(
      skills?.blocks
        .filter((block) => block.type === "skills-group")
        .map((block) => block.label),
      ["Interviews", "PRDs"]
    )
    assert.deepEqual(
      merged.sections.find((section) => section.id === "sec-act"),
      stored.sections.find((section) => section.id === "sec-act")
    )
    assert.deepEqual(
      merged.sections.find((section) => section.id === "sec-aw"),
      stored.sections.find((section) => section.id === "sec-aw")
    )
    assert.equal(
      cvBlockSchema.safeParse(merged.sections[0]?.blocks[0]).success,
      true
    )
  })
})

describe("block schema source", () => {
  it("accepts every registry empty block and rejects a type removed from a copy", () => {
    for (const type of BLOCK_TYPES) {
      assert.equal(
        cvBlockSchema.safeParse(blockEntry(type).empty()).success,
        true,
        type
      )
    }
    const filtered = blockRegistry.filter((entry) => entry.type !== "divider")
    const schema = cvBlockSchemaFrom(filtered)
    assert.equal(schema.safeParse(blockEntry("divider").empty()).success, false)
  })
})

describe("codec losses", () => {
  it("keeps experience location and names what the v1 codec cannot hold", () => {
    const fixture: CvDocument = {
      ...emptyCvDocument(),
      experience: [
        {
          role: "Discovery lead",
          company: "UIT",
          period: "2024",
          location: "Hanoi",
          bullets: ["Ran interviews"],
        },
      ],
      education: [{ school: "UIT", degree: "BSc", period: "2024", detail: "" }],
    }
    const blocks = cvCodecToBlocks(fixture)
    const role = blocks.sections
      .find((section) => section.kind === "experience")
      ?.blocks.find((block) => block.type === "experience-entry")
    assert.equal(role?.type, "experience-entry")
    if (role?.type === "experience-entry") assert.equal(role.location, "Hanoi")
    const back = blocksToCvCodec(blocks)
    assert.equal(back.experience[0]?.location, "Hanoi")
    assert.equal(Object.hasOwn(back.education[0] ?? {}, "detail"), false)

    blocks.sections.push(
      {
        id: "sec-act",
        kind: "activities",
        blocks: [{ id: "act-1", type: "text", text: "Debate club" }],
      },
      {
        id: "sec-aw",
        kind: "awards",
        blocks: [{ id: "aw-1", type: "text", text: "Dean list" }],
      }
    )
    const codec = blocksToCvCodec(blocks)
    assert.equal(JSON.stringify(codec).includes("Debate club"), false)
    assert.equal(JSON.stringify(codec).includes("Dean list"), false)
    assert.equal(blankBlockDocument().version, 2)
  })

  it("rejects a CV body that is neither v1 nor version 2 as Invalid content", () => {
    const version = decodePaperContent("cv", 1, { version: 3 })
    const header = decodePaperContent("cv", 1, { version: 2, header: {} })
    const v1 = decodePaperContent("cv", 1, { name: "nope" })
    for (const result of [version, header, v1]) {
      assert.equal(result.ok, false)
      if (result.ok) continue
      assert.equal(result.message, "Invalid content")
    }
  })
})
