import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { layoutPhotoSchema, photoBounds } from "./paper-doc/native-photo.js"
import {
  privateLayoutSchema,
  privatePhotoLayoutSchema,
} from "./paper-doc/native-layout.js"

function photo() {
  return layoutPhotoSchema.parse({
    id: "portrait",
    type: "photo",
    source: "file:00000000-0000-4000-8000-000000000001",
    width: 1440,
    height: 1800,
    crop: { top: 5000, right: 10000, bottom: 15000, left: 20000 },
    rotation: 30,
    shape: "rounded",
    placement: { kind: "block", alignment: "center" },
    spacing: { top: 60, right: 80, bottom: 100, left: 120 },
    alt: "Portrait of Linh",
  })
}
function document() {
  return privatePhotoLayoutSchema.parse({
    profile: "private-layout-2",
    kind: "letter",
    presentation: {
      codecVersion: 1,
      page: {
        width: 11906,
        height: 16838,
        orientation: "portrait",
        top: 1440,
        bottom: 1440,
        start: 1440,
        end: 1440,
      },
      inline: { fontId: "liberation-serif" },
      paragraph: {},
      styles: [],
    },
    flow: {
      id: "flow",
      type: "flow",
      children: [
        {
          id: "intro",
          type: "paragraph",
          paragraph: {},
          content: [{ text: "Dear team", bold: false }],
        },
        photo(),
        { id: "end", type: "paragraph", paragraph: {}, content: [] },
      ],
    },
  })
}
describe("private photo layout version and ownership", () => {
  it("keeps v1 strict while v2 retains every typed photo property", () => {
    const doc = document()
    assert.equal(
      privateLayoutSchema.safeParse({ ...doc, profile: "private-layout-1" })
        .success,
      false
    )
    assert.deepEqual(privatePhotoLayoutSchema.parse(doc), doc)
  })
  it("refuses external, blob, malformed and unowned-shaped source references", () => {
    for (const source of [
      "https://example.com/photo.png",
      "blob:photo",
      "file:no",
      "",
      "data:image/png;base64,AA==",
    ])
      assert.equal(
        layoutPhotoSchema.safeParse({ ...photo(), source }).success,
        false
      )
  })
  it("refuses empty crop area, fractional sizes and unequal circles", () => {
    assert.equal(
      layoutPhotoSchema.safeParse({
        ...photo(),
        crop: { top: 50000, bottom: 50000, left: 0, right: 0 },
      }).success,
      false
    )
    assert.equal(
      layoutPhotoSchema.safeParse({ ...photo(), width: 1440.5 }).success,
      false
    )
    assert.equal(
      layoutPhotoSchema.safeParse({ ...photo(), shape: "circle" }).success,
      false
    )
    assert.equal(
      layoutPhotoSchema.safeParse({ ...photo(), rotation: 360 }).success,
      false
    )
    assert.equal(
      layoutPhotoSchema.safeParse({ ...photo(), alt: "a".repeat(2001) })
        .success,
      false
    )
  })
  it("checks rotated bounds plus spacing against page and cell content widths", () => {
    const doc = document(),
      large = { ...photo(), width: 8000, height: 8000, rotation: 45 }
    assert.equal(
      privatePhotoLayoutSchema.safeParse({
        ...doc,
        flow: { ...doc.flow, children: [large] },
      }).success,
      false
    )
    const table = {
      id: "table",
      type: "table",
      columns: [{ id: "column", width: 2000 }],
      children: [
        {
          id: "row",
          type: "row",
          children: [
            {
              id: "cell",
              type: "cell",
              columnId: "column",
              children: [photo()],
            },
          ],
        },
      ],
    }
    assert.equal(
      privatePhotoLayoutSchema.safeParse({
        ...doc,
        flow: { ...doc.flow, children: [table] },
      }).success,
      false
    )
    assert.ok(photoBounds(photo()).width > photo().width)
  })
})
