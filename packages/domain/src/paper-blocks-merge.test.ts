import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

import {
  BLOCK_TYPES,
  blankBlockDocument,
  blockEntry,
  blockRegistry,
  blocksToCvCodec,
  cvBlockSchema,
  cvBlockSchemaFrom,
  cvCodecToBlocks,
  decodePaperContent,
  emptyCvDocument,
  type CvDocument,
} from "./index.ts"

describe("block schema source", () => {
  it("derives the block types from the registry and rejects every removed type", () => {
    const documentSource = readFileSync(
      new URL("./paper-blocks/document.ts", import.meta.url),
      "utf8"
    )
    const typesSource = readFileSync(
      new URL("./paper-blocks/types.ts", import.meta.url),
      "utf8"
    )
    assert.equal(documentSource.includes("BlockSchemaTuple"), false)
    assert.equal(typesSource.includes("export type BlockType ="), false)
    const required = [
      "text",
      "heading",
      "bulleted-list",
      "numbered-list",
      "divider",
      "experience-entry",
      "education-entry",
      "skills-group",
    ] as const
    assert.deepEqual(BLOCK_TYPES, required)
    for (const type of required) {
      assert.equal(
        cvBlockSchema.safeParse(blockEntry(type).empty()).success,
        true,
        type
      )
      const filtered = blockRegistry.filter((entry) => entry.type !== type)
      const schema = cvBlockSchemaFrom(filtered)
      assert.equal(
        schema.safeParse(blockEntry(type).empty()).success,
        false,
        type
      )
    }
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

  it("says Invalid content for a versioned body and the zod issue for a version-less body", () => {
    const version = decodePaperContent("cv", 1, { version: 3 })
    const header = decodePaperContent("cv", 1, { version: 2, header: {} })
    for (const result of [version, header]) {
      assert.equal(result.ok, false)
      if (result.ok) continue
      assert.equal(result.message, "Invalid content")
    }
    const versionLess = decodePaperContent("cv", 1, { name: 5 })
    assert.equal(versionLess.ok, false)
    if (versionLess.ok) return
    assert.equal(
      versionLess.message,
      'Invalid option: expected one of "internship"|"product"|"service"|"academic"|"photo"'
    )
  })
})
