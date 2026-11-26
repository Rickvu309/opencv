import { createHash } from "node:crypto"

import { describe, expect, it } from "vitest"

import { PaperPackage } from "./word-package/package-engine.js"
import { fixturePackage, paragraph } from "./word-package/package-fixtures.js"
import { parsePackageXml } from "./word-package/package-xml.js"

const context = {
  docId: "cv",
  incarnation: "import-one",
  revision: "revision-one",
}

const form = `<?mso-contentType?><FormTemplates xmlns="http://schemas.microsoft.com/sharepoint/v3/contenttype/forms"><Display>DocumentLibraryForm</Display><Edit>DocumentLibraryForm</Edit><New>DocumentLibraryForm</New></FormTemplates>`

function codes(document: PaperPackage) {
  return document
    .read()
    .regions.map((region) =>
      region.kind === "locked" ? region.reason.code : "editable"
    )
}

describe("leading xml notes", () => {
  it("reads the shared form part that starts with an instruction", () => {
    expect(Buffer.byteLength(form)).toBe(219)
    expect(createHash("sha256").update(form).digest("hex")).toBe(
      "5efcaf9ad70d9c29f406ee438f8f428b021a881d2c5afff0e53b00b1f67ae51e"
    )
    const part = parsePackageXml(Buffer.from(form))
    expect(part.root.local).toBe("FormTemplates")
    expect(part.root.opaque).toBe(false)
  })

  it("reads a second instruction and an instruction that carries data", () => {
    const part = parsePackageXml(Buffer.from("<?first?><?second data?><root/>"))
    expect(part.root.local).toBe("root")
    expect(part.root.opaque).toBe(false)
  })

  it("reads a comment before the root", () => {
    const part = parsePackageXml(Buffer.from("<!-- note --><root/>"))
    expect(part.root.local).toBe("root")
    expect(part.root.opaque).toBe(false)
  })

  it("reads a raw block before the root without locking it", () => {
    const part = parsePackageXml(Buffer.from("<![CDATA[x]]><root/>"))
    expect(part.root.local).toBe("root")
    expect(part.root.opaque).toBe(false)
  })

  it("marks the parent when the instruction sits inside an element", () => {
    const part = parsePackageXml(Buffer.from("<root><?note?>kept</root>"))
    expect(part.root.opaque).toBe(true)
  })

  it("keeps the writing editable when only a side part has the instruction", async () => {
    const document = await PaperPackage.open(
      fixturePackage(paragraph("kept"), {
        parts: { "customXml/item1.xml": form },
      }),
      context
    )
    expect(codes(document)).toEqual(["editable"])
  })

  it("locks the paragraph that contains the instruction", async () => {
    const document = await PaperPackage.open(
      fixturePackage("<w:p><w:r><?note?><w:t>kept</w:t></w:r></w:p>"),
      context
    )
    expect(codes(document)).toEqual(["OPAQUE_OR_SECTION_BOUNDARY"])
  })
})
