import { describe, expect, it } from "vitest"
import { paperDocumentInfoSchema } from "@workspace/domain/paper-doc"
import { richDocumentAnswer } from "../../../../scripts/ui/rich-document-answer.mjs"

describe("the ui tool rich document fixture", () => {
  it("answers the paper document read with a schema-valid body", () => {
    const data = richDocumentAnswer().data
    expect(paperDocumentInfoSchema.safeParse(data).success).toBe(true)
  })

  it("fails the same check when the fixture drops a required field", () => {
    const stale = richDocumentAnswer().data
    Reflect.deleteProperty(stale, "updatedAt")
    expect(paperDocumentInfoSchema.safeParse(stale).success).toBe(false)
  })
})
