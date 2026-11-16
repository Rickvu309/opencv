import assert from "node:assert/strict"
import { it } from "node:test"
import { layoutPhotoSchema } from "./paper-doc/native-photo.js"
import {
  croppedPhotoRatio,
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
