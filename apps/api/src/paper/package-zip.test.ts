import { describe, expect, it } from "vitest"

import { fixtureZip } from "./package-fixtures.js"
import { PACKAGE_LIMITS } from "./package-limits.js"
import { parsePackageXml } from "./package-xml.js"
import { readPackageZip } from "./package-zip.js"

function directoryOffset(bytes: Buffer) {
  return bytes.readUInt32LE(bytes.length - 6)
}

describe("bounded ZIP admission", () => {
  it("B4 refuses OPC case-equivalent member names", async () => {
    const bytes = fixtureZip({
      "word/document.xml": "<root/>",
      "WORD/DOCUMENT.XML": "<shadow/>",
    })
    await expect(readPackageZip(bytes)).rejects.toThrow("DUPLICATE_ZIP_MEMBER")
  })

  it.each([0, 8])("reads admitted ZIP32 method %i", async (method) => {
    const bytes = fixtureZip({ "file.xml": "<root>hello</root>" }, method)
    expect(
      (await readPackageZip(bytes)).files.get("file.xml")?.toString()
    ).toBe("<root>hello</root>")
  })

  it("rejects compressed input before directory decoding", async () => {
    await expect(
      readPackageZip(Buffer.alloc(PACKAGE_LIMITS.compressedBytes + 1))
    ).rejects.toThrow("ZIP_INPUT_LIMIT")
  })

  it("rejects the declared expansion bound before an invalid deflate stream is opened", async () => {
    const bytes = fixtureZip({ "file.xml": "small" })
    const central = directoryOffset(bytes)
    bytes.writeUInt32LE(PACKAGE_LIMITS.memberBytes + 1, 22)
    bytes.writeUInt32LE(PACKAGE_LIMITS.memberBytes + 1, central + 24)
    bytes[30 + bytes.readUInt16LE(26)] = 0xff
    await expect(readPackageZip(bytes)).rejects.toThrow("ZIP_EXPANSION_LIMIT")
  })

  it("halts actual expansion at the stream boundary when directory sizes lie", async () => {
    const bytes = fixtureZip({ "file.xml": "x".repeat(64 * 1024) })
    const central = directoryOffset(bytes)
    bytes.writeUInt32LE(1, 22)
    bytes.writeUInt32LE(1, central + 24)
    await expect(readPackageZip(bytes)).rejects.toThrow("ZIP_STREAM_LIMIT")
  })

  it.each([
    "../escape.xml",
    "/absolute.xml",
    "word//file.xml",
    "word/%2e.xml",
    "word\\file.xml",
  ])("rejects ambiguous or escaping member name %s", async (name) => {
    await expect(readPackageZip(fixtureZip({ [name]: "x" }))).rejects.toThrow(
      "UNSAFE_ZIP_NAME"
    )
  })

  it.each(["encrypted", "descriptor", "ZIP64", "CRC", "local-name", "overlap"])(
    "rejects %s rather than repairing the archive",
    async (failure) => {
      const bytes = fixtureZip({ "one.xml": "hello", "two.xml": "world" })
      const central = directoryOffset(bytes)
      if (failure === "encrypted") bytes.writeUInt16LE(1, central + 8)
      if (failure === "descriptor") bytes.writeUInt16LE(8, central + 8)
      if (failure === "ZIP64") bytes.writeUInt32LE(0xffffffff, central + 24)
      if (failure === "CRC") {
        bytes.writeUInt32LE(0, central + 16)
        bytes.writeUInt32LE(0, 14)
      }
      if (failure === "local-name") bytes[30] = 0x41
      if (failure === "overlap") {
        const next = central + 46 + bytes.readUInt16LE(central + 28)
        bytes.writeUInt32LE(0, next + 42)
      }
      await expect(readPackageZip(bytes)).rejects.toThrow()
    }
  )

  it("refuses duplicate directory names", async () => {
    const bytes = fixtureZip({ "one.xml": "hello", "two.xml": "world" })
    const first = directoryOffset(bytes)
    const second = first + 46 + bytes.readUInt16LE(first + 28)
    Buffer.from("one.xml").copy(bytes, second + 46)
    await expect(readPackageZip(bytes)).rejects.toThrow("DUPLICATE_ZIP_MEMBER")
  })
})

describe("bounded XML admission", () => {
  it.each([
    ["DTD", '<!DOCTYPE root [<!ENTITY x "expanded">]><root>&x;</root>'],
    ["unknown entity", "<root>&unknown;</root>"],
    ["unbound namespace", "<w:root/>"],
    ["duplicate attribute", '<root a="one" a="two"/>'],
    ["mismatched nesting", "<root><child></root>"],
    ["namespace rebinding", '<root xmlns:xml="urn:wrong"/>'],
    ["invalid character", "<root>\u0000</root>"],
  ])("refuses %s", (_, xml) => {
    expect(() => parsePackageXml(Buffer.from(xml))).toThrow()
  })

  it("bounds depth and attribute counts before DOM materialization", () => {
    expect(() =>
      parsePackageXml(
        Buffer.from(
          "<n>".repeat(PACKAGE_LIMITS.xmlDepth + 1) +
            "</n>".repeat(PACKAGE_LIMITS.xmlDepth + 1)
        )
      )
    ).toThrow("XML_STRUCTURE_LIMIT")
    const attributes = Array.from(
      { length: PACKAGE_LIMITS.xmlAttributes + 1 },
      (_, index) => `a${index}="v"`
    ).join(" ")
    expect(() => parsePackageXml(Buffer.from(`<n ${attributes}/>`))).toThrow(
      "XML_ATTRIBUTE_LIMIT"
    )
  })

  it("shares the element budget across package parts", () => {
    const budget = { elements: PACKAGE_LIMITS.xmlElements - 1 }
    parsePackageXml(Buffer.from("<root/>"), budget)
    expect(() => parsePackageXml(Buffer.from("<next/>"), budget)).toThrow(
      "XML_STRUCTURE_LIMIT"
    )
  })
})
