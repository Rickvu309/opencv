import { describe, expect, it } from "vitest"
import { compileLayoutNativeDocx } from "./formatted.js"
import { presentation, paragraph } from "./formatted.test-support.js"
import { readPackageZip } from "../import/package-zip.js"
import { parsePackageXml } from "../import/package-xml.js"
import { attribute, elements, one } from "./inspect.test-support.js"

const A = "http://schemas.openxmlformats.org/drawingml/2006/main"
const WP =
  "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
const REL =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
const PKG = "http://schemas.openxmlformats.org/package/2006/relationships"
const source = "file:11111111-1111-4111-8111-111111111111"
const bytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6gAAAABJRU5ErkJggg==",
  "base64"
)
function photo() {
  return {
    id: "portrait",
    type: "photo",
    source,
    width: 1800,
    height: 1800,
    crop: { top: 10000, right: 20000, bottom: 15000, left: 25000 },
    rotation: 30,
    shape: "rounded",
    placement: { kind: "block", alignment: "center" },
    spacing: { top: 120, right: 240, bottom: 360, left: 480 },
    alt: 'A portrait of Nguyễn & "Ada"',
  }
}
function document(
  children: unknown[] = [photo(), paragraph("body", "Editable text")]
) {
  return {
    profile: "private-layout-2",
    kind: "letter",
    presentation: presentation(),
    flow: { id: "flow", type: "flow", children },
  }
}
function compile(
  input: unknown,
  media = [{ source, mediaType: "image/png" as const, bytes }]
) {
  const result = compileLayoutNativeDocx({ document: input, photos: media })
  if (result.kind === "refused") throw new Error(result.reason)
  return result.value
}
async function output(input: unknown) {
  const archive = await readPackageZip(compile(input))
  const part = archive.files.get("word/document.xml")
  if (!part) throw new Error("Missing document part")
  return { archive, ...parsePackageXml(part) }
}
describe("editable Word photo output", () => {
  it("embeds the exact original image bytes and editable crop, rotation, shape and alternative text", async () => {
    const { archive, root } = await output(document())
    expect(archive.files.get("word/media/photo1.png")).toEqual(bytes)
    const rect = one(root, "srcRect", A)
    expect(["t", "r", "b", "l"].map((key) => attribute(rect, key, ""))).toEqual(
      ["10000", "20000", "15000", "25000"]
    )
    expect(
      elements(root, "xfrm", A).some(
        (node) => attribute(node, "rot", "") === "1800000"
      )
    ).toBe(true)
    expect(attribute(one(root, "prstGeom", A), "prst", "")).toBe("roundRect")
    expect(attribute(one(root, "docPr", WP), "descr", "")).toBe(photo().alt)
    expect(attribute(one(root, "blip", A), "embed", REL)).toBe("photo1")
    expect(Number(attribute(one(root, "extent", WP), "cx", ""))).toBe(
      Math.round(1800 * (Math.cos(Math.PI / 6) + Math.sin(Math.PI / 6)) * 635)
    )
    expect(attribute(one(root, "jc"), "val")).toBe("center")
    expect(elements(root, "t")).toHaveLength(1)
  })
  it("writes floating wrapping and spacing without flattening the text", async () => {
    const { root } = await output(
      document([
        { ...photo(), placement: { kind: "wrap", side: "right" } },
        paragraph("following"),
      ])
    )
    const anchor = one(root, "anchor", WP)
    expect(attribute(anchor, "distL", "")).toBe("304800")
    expect(attribute(anchor, "distR", "")).toBe("152400")
    expect(attribute(one(root, "wrapSquare", WP), "wrapText", "")).toBe(
      "bothSides"
    )
    expect(elements(root, "inline", WP)).toHaveLength(0)
    expect(elements(root, "t")).toHaveLength(1)
  })
  it("reserves rotated bounds while retaining the original editable image dimensions", async () => {
    const { root, source: xmlSource } = await output(
      document([
        {
          ...photo(),
          width: 2400,
          height: 1200,
          rotation: 90,
          placement: { kind: "wrap", side: "right" },
        },
      ])
    )
    const extent = one(root, "extent", WP)
    expect(
      ["cx", "cy"].map((key) => Number(attribute(extent, key, "")))
    ).toEqual([1200 * 635, 2400 * 635])
    const transform = elements(root, "xfrm", A).find(
      (node) => attribute(node, "rot", "") === "5400000"
    )
    if (!transform) throw new Error("Missing editable rotated picture")
    expect(
      ["cx", "cy"].map((key) =>
        Number(attribute(one(transform, "ext", A), key, ""))
      )
    ).toEqual([2400 * 635, 1200 * 635])
    expect(
      ["x", "y"].map((key) =>
        Number(attribute(one(transform, "off", A), key, ""))
      )
    ).toEqual([-600 * 635, 600 * 635])
    expect(
      elements(root, "posOffset", WP).map((node) =>
        xmlSource.slice(node.openEnd, node.closeStart)
      )
    ).toEqual([
      String(
        (presentation().page.width -
          presentation().page.start -
          presentation().page.end -
          1200 -
          240) *
          635
      ),
      String(120 * 635),
    ])
    expect(
      ["l", "t", "r", "b"].map((key) =>
        attribute(one(root, "effectExtent", WP), key, "")
      )
    ).toEqual(["0", "0", "0", "0"])
  })
  it("deduplicates image bytes but gives each occurrence a unique drawing identity, including cells", async () => {
    const table = {
      id: "table",
      type: "table",
      columns: [{ id: "column", width: 6000 }],
      children: [
        {
          id: "row",
          type: "row",
          children: [
            {
              id: "cell",
              type: "cell",
              columnId: "column",
              children: [
                { ...photo(), id: "cell-photo", rotation: 0, shape: "circle" },
                paragraph("cell-text"),
              ],
            },
          ],
        },
      ],
    }
    const { archive, root } = await output(document([photo(), table]))
    expect(
      [...archive.files.keys()].filter((name) => name.startsWith("word/media/"))
    ).toEqual(["word/media/photo1.png"])
    expect(
      elements(root, "docPr", WP).map((node) => attribute(node, "id", ""))
    ).toEqual(["1", "2"])
    const relationships = archive.files.get("word/_rels/document.xml.rels")
    if (!relationships) throw new Error("Missing relationships")
    expect(
      elements(parsePackageXml(relationships).root, "Relationship", PKG).filter(
        (node) => attribute(node, "Type", "")?.endsWith("/image")
      )
    ).toHaveLength(1)
  })
  it.each([
    [
      "missing owned bytes",
      () => compileLayoutNativeDocx({ document: document() }),
    ],
    [
      "wrong source",
      () =>
        compileLayoutNativeDocx({
          document: document(),
          photos: [
            {
              source: "file:22222222-2222-4222-8222-222222222222",
              mediaType: "image/png",
              bytes,
            },
          ],
        }),
    ],
    [
      "external URL",
      () =>
        compileLayoutNativeDocx({
          document: document([
            { ...photo(), source: "https://example.com/photo.png" },
          ]),
        }),
    ],
    [
      "spoofed bytes",
      () =>
        compileLayoutNativeDocx({
          document: document(),
          photos: [
            {
              source,
              mediaType: "image/png",
              bytes: new Uint8Array([1, 2, 3]),
            },
          ],
        }),
    ],
    [
      "old profile",
      () =>
        compileLayoutNativeDocx({
          document: { ...document(), profile: "private-layout-1" },
        }),
    ],
  ])("refuses %s", (_name, run) => expect(run().kind).toBe("refused"))
})
