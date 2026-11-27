import { describe, expect, it } from "vitest"
import {
  nativeProvenanceSchema,
  paperDocumentInfoSchema,
} from "@workspace/domain/paper-doc"
import { richDocumentAnswer } from "../../../../scripts/ui/rich-document-answer.mjs"

const provenance = nativeProvenanceSchema.parse({
  documentVersion: 4,
  schemaRevision: 2,
  writerProtocol: 1,
  profile: "private-layout-3",
  requiredCapabilities: [
    "rich-text-1",
    "semantic-cv-fields-1",
    "document-presentation-1",
    "tables-1",
    "photos-1",
    "flow-sections-1",
  ],
})

describe("the ui tool rich document fixture", () => {
  it("answers the paper document read with a schema-valid body", () => {
    const data = richDocumentAnswer(provenance).data
    expect(paperDocumentInfoSchema.safeParse(data).success).toBe(true)
  })

  it("fails the same check when the fixture drops a required field", () => {
    const stale = richDocumentAnswer(provenance).data
    Reflect.deleteProperty(stale, "updatedAt")
    expect(paperDocumentInfoSchema.safeParse(stale).success).toBe(false)
  })
})
