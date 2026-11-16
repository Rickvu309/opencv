import assert from "node:assert/strict"
import { it } from "node:test"
import { layoutPhotoSchema } from "./paper-doc/native-photo.js"
import {
  croppedPhotoRatio,
  photoInsertSize,
  fitPhotoCrop,
  photoSourceRatio,
  resizePhoto,
} from "./paper-doc/native-photo-geometry.js"

const crop = { top: 0, right: 0, bottom: 0, left: 0 }
const portrait = layoutPhotoSchema.parse({
  id: "portrait",
  type: "photo",
  source: "file:00000000-0000-4000-8000-000000000001",
  width: 1800,
  height: 2400,
  crop,
  rotation: 0,
  shape: "rectangle",
  placement: { kind: "block", alignment: "left" },
  spacing: crop,
  alt: "Portrait",
})

it("locks portrait proportions when either dimension changes", () => {
  assert.deepEqual(
    [
      resizePhoto(portrait, "width", 900, 0.75).height,
      resizePhoto(portrait, "height", 1200, 0.75).width,
    ],
    [1200, 900]
  )
})

it("centers a square crop on a portrait or landscape instead of stretching", () => {
  const square = fitPhotoCrop(0.75, 1, crop)
  assert.deepEqual(square, { ...crop, top: 12500, bottom: 12500 })
  assert.deepEqual(fitPhotoCrop(2, 1, crop), {
    ...crop,
    left: 25000,
    right: 25000,
  })
  assert.equal(croppedPhotoRatio(0.75, square), 1)
  const circle = layoutPhotoSchema.parse({
    ...portrait,
    shape: "circle",
    height: 1800,
    crop: square,
  })
  assert.equal(photoSourceRatio(circle), 0.75)
  assert.equal(resizePhoto(circle, "width", 900, 0.75).height, 900)
})

it("preserves an existing crop while fitting its visible region", () => {
  const fitted = fitPhotoCrop(0.75, 1, { ...crop, left: 10000, right: 10000 })
  assert.deepEqual(fitted, {
    top: 20000,
    right: 10000,
    bottom: 20000,
    left: 10000,
  })
  assert.equal(croppedPhotoRatio(0.75, fitted), 1)
  assert.throws(() => fitPhotoCrop(0.75, 1, { ...crop, left: 100000 }))
})

it("keeps the committed circle edge and can reverse every crop to zero", () => {
  const ratio = 2687 / 3356
  let fitted = fitPhotoCrop(ratio, 1, crop)
  fitted = fitPhotoCrop(ratio, 1, { ...fitted, top: 5000 }, "top")
  assert.equal(fitted.top, 5000)
  assert.ok(Math.abs(croppedPhotoRatio(ratio, fitted) - 1) < 0.00002)
  fitted = fitPhotoCrop(ratio, 1, { ...fitted, bottom: 0 }, "bottom")
  assert.equal(fitted.bottom, 0)
  assert.equal(fitted.left, 0)
  assert.equal(fitted.right, 0)
  for (const edge of ["top", "right", "bottom", "left"] as const) {
    fitted = fitPhotoCrop(ratio, 1, { ...fitted, [edge]: 25000 }, edge)
    fitted = fitPhotoCrop(ratio, 1, { ...fitted, [edge]: 0 }, edge)
    assert.equal(fitted[edge], 0)
    assert.ok(Math.abs(croppedPhotoRatio(ratio, fitted) - 1) < 0.0001)
  }
})

it("refuses source proportions that cannot fit before storing a photo", () => {
  for (const ratio of [20, 1 / 200, 0, Infinity, NaN])
    assert.throws(() => photoInsertSize(ratio))
  assert.deepEqual(photoInsertSize(1), { width: 2160, height: 2160 })
  assert.deepEqual(photoInsertSize(2, 1200), { width: 1200, height: 600 })
})

it("keeps a visible square when an extreme circle edge follows deep zoom", () => {
  const zoomed = { left: 24300, right: 29100, top: 60000, bottom: 2700 }
  for (const edge of ["left", "right", "top", "bottom"] as const) {
    const fitted = fitPhotoCrop(
      2687 / 3356,
      1,
      { ...zoomed, [edge]: 99900 },
      edge
    )
    assert.equal(fitted[edge], 99900)
    assert.ok(fitted.left + fitted.right < 100000)
    assert.ok(fitted.top + fitted.bottom < 100000)
    assert.ok(Math.abs(croppedPhotoRatio(2687 / 3356, fitted) - 1) < 0.015)
    layoutPhotoSchema.parse({
      ...portrait,
      shape: "circle",
      height: 1800,
      crop: fitted,
    })
  }
})
