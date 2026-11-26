import { describe, expect, it } from "vitest"
import {
  flowDocumentSchema,
  prepareFlowPhotoEdit,
  fitPhotoCrop,
  resizePhoto,
  layoutPhotoSchema,
} from "@workspace/domain/internal/paper-presentation"
import { compileFlowNativeDocx } from "./formatted.js"
import { cv, paragraph, presentation } from "./formatted.test-support.js"
import { readPackageZip } from "../import/package-zip.js"
import { parsePackageXml } from "../import/package-xml.js"
import { attribute, elements, one } from "./inspect.test-support.js"

const A = "http://schemas.openxmlformats.org/drawingml/2006/main"
const WP =
  "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
const source = "file:11111111-1111-4111-8111-111111111111"
const replacement = "file:22222222-2222-4222-8222-222222222222"
const bytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6gAAAABJRU5ErkJggg==",
  "base64"
)

describe("rich CV and Letter photo Word output", () => {
  for (const kind of ["cv", "letter"] as const) {
    it(`exports ${kind} locked portrait sizing and centered circle crop`, async () => {
      const appearance = presentation()
      const portrait = layoutPhotoSchema.parse({
        id: "portrait",
        type: "photo",
        source,
        width: 1800,
        height: 2400,
        crop: { top: 0, right: 0, bottom: 0, left: 0 },
        rotation: 0,
        shape: "rectangle",
        placement: { kind: "block", alignment: "center" },
        spacing: { top: 0, right: 0, bottom: 0, left: 0 },
        alt: "Portrait",
      })
      const resized = resizePhoto(portrait, "height", 3200, 0.75)
      for (const photo of [
        resized,
        {
          ...resized,
          shape: "circle",
          height: resized.width,
          crop: fitPhotoCrop(0.75, 1, portrait.crop),
        },
      ]) {
        const document = flowDocumentSchema.parse({
          profile: "private-layout-3",
          kind,
          presentation: appearance,
          flow: {
            id: "flow",
            type: "flow",
            children: [
              {
                id: "section",
                type: "flowSection",
                start: "continuous",
                page: appearance.page,
                columns: { count: 1, gap: 360 },
                children: [
                  ...(kind === "cv" ? [cv().header] : []),
                  paragraph("body", "Portrait proof"),
                  photo,
                ],
              },
            ],
          },
        })
        const output = compileFlowNativeDocx({
          document,
          photos: [{ source, mediaType: "image/png", bytes }],
        })
        if (output.kind === "refused") throw new Error(output.reason)
        const archive = await readPackageZip(output.value)
        const xml = archive.files.get("word/document.xml")
        if (!xml) throw new Error("Missing Word document")
        const { root } = parsePackageXml(xml)
        expect(
          ["cx", "cy"].map((key) => attribute(one(root, "extent", WP), key, ""))
        ).toEqual(
          photo.shape === "circle"
            ? ["1524000", "1524000"]
            : ["1524000", "2032000"]
        )
        expect(
          ["t", "r", "b", "l"].map((key) =>
            attribute(one(root, "srcRect", A), key, "")
          )
        ).toEqual(
          photo.shape === "circle"
            ? ["12500", "0", "12500", "0"]
            : ["0", "0", "0", "0"]
        )
      }
    })
    for (const [shape, geometry] of [
      ["rectangle", "rect"],
      ["rounded", "roundRect"],
      ["circle", "ellipse"],
    ] as const) {
      it(`exports ${kind} ${shape} edits with the original image, extent, crop, alignment and alt text`, async () => {
        const appearance = presentation()
        let document = flowDocumentSchema.parse({
          profile: "private-layout-3",
          kind,
          presentation: appearance,
          flow: {
            id: "flow",
            type: "flow",
            children: [
              {
                id: "section",
                type: "flowSection",
                start: "continuous",
                page: appearance.page,
                columns: { count: 1, gap: 360 },
                children:
                  kind === "cv"
                    ? [cv().header, paragraph("body", "Editable CV")]
                    : [paragraph("body", "Editable Letter")],
              },
            ],
          },
        })
        const change = (edit: unknown) => {
          const result = prepareFlowPhotoEdit(document, edit)
          if (result.kind === "refused") throw new Error(result.reason)
          document = result.value.document
        }
        const photo = {
          id: "photo",
          type: "photo",
          source,
          width: 2160,
          height: 1080,
          crop: { top: 0, right: 0, bottom: 0, left: 0 },
          rotation: 0,
          shape: "rectangle",
          placement: { kind: "block", alignment: "left" },
          spacing: { top: 0, right: 0, bottom: 0, left: 0 },
          alt: "",
        }
        change({
          kind: "insert-photo",
          photo,
          destination: { parentId: "section", afterId: "body" },
        })
        change({
          kind: "update-photo",
          photo: {
            ...photo,
            width: 1800,
            height: 1800,
            shape,
            crop: { top: 10000, right: 20000, bottom: 5000, left: 15000 },
            placement: { kind: "block", alignment: "right" },
            alt: "Portrait of Linh",
          },
        })
        change({ kind: "replace-photo", photoId: "photo", source: replacement })
        const compile = () => {
          const output = compileFlowNativeDocx({
            document,
            photos: [{ source: replacement, mediaType: "image/png", bytes }],
          })
          if (output.kind === "refused") throw new Error(output.reason)
          return output.value
        }
        const archive = await readPackageZip(compile())
        expect(archive.files.get("word/media/photo1.png")).toEqual(bytes)
        const xml = archive.files.get("word/document.xml")
        if (!xml) throw new Error("Missing Word document")
        const { root } = parsePackageXml(xml)
        expect(attribute(one(root, "prstGeom", A), "prst", "")).toBe(geometry)
        expect(
          ["cx", "cy"].map((key) => attribute(one(root, "extent", WP), key, ""))
        ).toEqual(["1143000", "1143000"])
        expect(
          ["t", "r", "b", "l"].map((key) =>
            attribute(one(root, "srcRect", A), key, "")
          )
        ).toEqual(["10000", "20000", "5000", "15000"])
        expect(attribute(one(root, "docPr", WP), "descr", "")).toBe(
          "Portrait of Linh"
        )
        expect(
          elements(root, "jc").some(
            (node) => attribute(node, "val") === "right"
          )
        ).toBe(true)
        change({ kind: "remove-photo", photoId: "photo" })
        const removed = await readPackageZip(compile())
        expect(
          [...removed.files.keys()].filter((name) =>
            name.startsWith("word/media/")
          )
        ).toEqual([])
      })
    }
  }
})
