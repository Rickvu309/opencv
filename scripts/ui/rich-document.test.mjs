import assert from "node:assert/strict"
import test from "node:test"
import { richDocumentAnswer } from "./rich-document.mjs"

const { nativeProvenanceSchema, paperDocumentInfoSchema } = await import(
  new URL("../../packages/domain/dist/index.js", import.meta.url)
)

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

test("the rich document fixture answers the paper document read with a schema-valid body", () => {
  const data = richDocumentAnswer(provenance).data
  assert.equal(paperDocumentInfoSchema.safeParse(data).success, true)
})

test("a fixture body that drops a field the contract requires fails the same check", () => {
  const stale = richDocumentAnswer(provenance).data
  delete stale.updatedAt
  assert.equal(paperDocumentInfoSchema.safeParse(stale).success, false)
})
