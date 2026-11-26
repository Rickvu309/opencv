import { describe, expect, it } from "vitest"

import { PaperPackage } from "./word-package/package-engine.js"
import {
  fixtureFiles,
  fixturePackage,
  fixtureZip,
  paragraph,
  relationship,
  run,
} from "./word-package/package-fixtures.js"

const context = {
  docId: "cv",
  incarnation: "import-one",
  revision: "revision-one",
}

const drawing = `<w:p><w:r><w:drawing xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:blip r:link="track"/></w:drawing>${run("tracked")}</w:r></w:p>`

function codes(document: PaperPackage) {
  return document
    .read()
    .regions.map((region) =>
      region.kind === "locked" ? region.reason.code : "editable"
    )
}

describe("relationship eligibility", () => {
  it("leaves paragraphs editable when none of them use an unproven relationship", async () => {
    const document = await PaperPackage.open(
      fixturePackage(paragraph("kept") + paragraph("also"), {
        relationships: [
          relationship(
            "track",
            "image",
            "https://example.invalid/pixel?id=1",
            true
          ),
        ],
      }),
      context
    )
    expect(codes(document)).toEqual(["editable", "editable"])
  })

  it("locks only the paragraph that uses the unproven relationship", async () => {
    const document = await PaperPackage.open(
      fixturePackage(paragraph("kept") + drawing, {
        relationships: [
          relationship(
            "track",
            "image",
            "https://example.invalid/pixel?id=1",
            true
          ),
        ],
      }),
      context
    )
    expect(codes(document)).toEqual(["editable", "UNPROVEN_RELATIONSHIP"])
    expect(document.read().regions[1]).toMatchObject({
      kind: "locked",
      reason: {
        code: "UNPROVEN_RELATIONSHIP",
        message:
          "This text depends on a relationship Paper cannot safely prove yet.",
      },
    })
    const region = document.read().regions[0]
    if (region.kind !== "editable") throw new Error("Missing editable target")
    const edited = await document.prepare({
      docId: context.docId,
      basedOn: document.read().revision,
      edits: [
        {
          op: "replaceText",
          targetId: region.targetId,
          before: "kept",
          after: "changed",
        },
      ],
    })
    expect(edited.package.read().regions.map((item) => item.text)).toEqual([
      "changed",
      "tracked",
    ])
    expect(codes(edited.package)).toEqual(["editable", "UNPROVEN_RELATIONSHIP"])
  })

  it("locks the document when an unproven relationship is used outside a paragraph", async () => {
    const files = fixtureFiles(paragraph("kept"), {
      relationships: [
        relationship(
          "track",
          "image",
          "https://example.invalid/pixel?id=1",
          true
        ),
      ],
    })
    files["word/document.xml"] = files["word/document.xml"]
      .toString()
      .replace(
        "<w:sectPr/>",
        '<w:sectPr><w:headerReference w:type="default" r:id="track"/></w:sectPr>'
      )
    const document = await PaperPackage.open(fixtureZip(files), context)
    expect(codes(document)).toEqual(["UNPROVEN_RELATIONSHIP"])
  })

  it("locks only the paragraph that carries unproven drawing markup", async () => {
    const marked = `<w:p><w:r><w:drawing xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:a14="http://schemas.microsoft.com/office/drawing/2010/main"><a:ext><a14:useLocalDpi/></a:ext></w:drawing>${run("tracked")}</w:r></w:p>`
    const document = await PaperPackage.open(
      fixturePackage(paragraph("kept") + marked),
      context
    )
    expect(codes(document)).toEqual(["editable", "UNPROVEN_EXTENSION_REACH"])
  })

  it("locks only the paragraph that carries unknown markup", async () => {
    const document = await PaperPackage.open(
      fixturePackage("<w:p><w:futureRef/></w:p>" + paragraph("kept")),
      context
    )
    expect(codes(document)).toEqual(["UNPROVEN_STORY_CONSUMER", "editable"])
  })

  it("still locks the document when a known relationship does not resolve", async () => {
    const document = await PaperPackage.open(
      fixturePackage(paragraph("kept") + paragraph("also"), {
        relationships: [relationship("header1", "header", "header1.xml")],
      }),
      context
    )
    expect(codes(document)).toEqual([
      "DANGLING_RELATIONSHIP",
      "DANGLING_RELATIONSHIP",
    ])
  })
})
