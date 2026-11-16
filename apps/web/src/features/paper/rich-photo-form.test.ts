import { expect, it } from "vitest"
import {
  croppedPhotoRatio,
  layoutPhotoSchema,
} from "@workspace/domain/internal/paper-presentation"
import { parsePhotoForm, photoFields, photoNumbers } from "./rich-photo-form.ts"

const photo = layoutPhotoSchema.parse({
  id: "portrait",
  type: "photo",
  source: "file:00000000-0000-4000-8000-000000000001",
  width: 1800,
  height: 1800,
  crop: { top: 0, right: 0, bottom: 0, left: 0 },
  rotation: 0,
  shape: "rectangle",
  placement: { kind: "block", alignment: "left" },
  spacing: { top: 0, right: 0, bottom: 0, left: 0 },
  alt: "Portrait",
})

it("Apply preserves every shown field after seeded commits and sequences", () => {
  let seed = 1584
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
  let committed = 0
  let mismatches = 0
  const covered = { narrow: 0, wide: 0, wideCircle: 0 }
  for (const sourceRatio of [0.4, 0.5625, 2687 / 3356, 0.75, 1, 2, 2.2, 3]) {
    for (const shape of ["rectangle", "rounded", "circle"] as const) {
      const crop = Object.fromEntries(
        ["top", "right", "bottom", "left"].map((edge) => [
          edge,
          Math.round(random() * 30000),
        ])
      )
      const original = layoutPhotoSchema.parse({
        ...photo,
        crop,
        shape,
        width: 2160,
        height: shape === "circle" ? 2160 : Math.round(2160 / sourceRatio),
      })
      const initial = parsePhotoForm(
        original,
        photoFields(original),
        sourceRatio,
        "shape"
      )
      if (!initial.ok) throw new Error("Initial photo required")
      for (const field of photoNumbers) {
        for (let round = 0; round < 200; round++) {
          const value = String(
            Math.round(
              (field === "width" || field === "height"
                ? 16 + random() * 950
                : random() * 87) * 1000
            ) / 1000
          )
          const commit = parsePhotoForm(
            initial.photo,
            { ...initial.fields, [field]: value },
            sourceRatio,
            field
          )
          if (!commit.ok) continue
          committed++
          const ratio = croppedPhotoRatio(sourceRatio, commit.photo.crop)
          if (ratio < 0.5) covered.narrow++
          if (ratio > 2) covered.wide++
          if (shape === "circle" && sourceRatio > 2) covered.wideCircle++
          const applied = parsePhotoForm(
            initial.photo,
            commit.fields,
            sourceRatio
          )
          if (!applied.ok) throw new Error(JSON.stringify(applied.errors))
          if (
            JSON.stringify(photoFields(applied.photo)) !==
            JSON.stringify(commit.fields)
          )
            mismatches++
          expect(
            photoFields(applied.photo),
            `${shape} ${field} ${value} ratio ${sourceRatio}`
          ).toEqual(commit.fields)
          let fields = commit.fields
          const steps = 2 + Math.floor(random() * 3)
          for (let step = 0; step < steps; step++) {
            const nextField =
              photoNumbers[Math.floor(random() * photoNumbers.length)]
            if (!nextField) throw new Error("Photo field required")
            const next = parsePhotoForm(
              initial.photo,
              {
                ...fields,
                [nextField]: String(
                  nextField === "width" || nextField === "height"
                    ? 16 + random() * 950
                    : random() * 40
                ),
              },
              sourceRatio,
              nextField
            )
            if (!next.ok) continue
            fields = next.fields
            const saved = parsePhotoForm(initial.photo, fields, sourceRatio)
            if (!saved.ok) throw new Error(JSON.stringify(saved.errors))
            committed++
            if (
              JSON.stringify(photoFields(saved.photo)) !==
              JSON.stringify(fields)
            )
              mismatches++
            expect(photoFields(saved.photo)).toEqual(fields)
          }
        }
      }
    }
  }
  expect(committed).toBeGreaterThan(10000)
  expect(mismatches).toBe(0)
  for (const count of Object.values(covered)) expect(count).toBeGreaterThan(0)
})

it("keeps a stored Circle's small crop rounding error on unedited Apply", () => {
  const original = {
    ...photo,
    shape: "circle" as const,
    width: 2700,
    height: 2700,
    crop: { top: 9967, bottom: 9967, left: 0, right: 0 },
  }
  expect(croppedPhotoRatio(2687 / 3356, original.crop)).not.toBe(1)
  const result = parsePhotoForm(original, photoFields(original), 2687 / 3356)
  expect(result).toMatchObject({ ok: true, photo: original })
})

it("rounds displayed sizes to two decimals without losing a twip", () => {
  for (let size = 240; size <= 31680; size++) {
    const original = { ...photo, width: size, height: size }
    const fields = photoFields(original)
    expect(fields.width).toMatch(/^\d+(?:\.\d{1,2})?$/)
    expect(fields.height).toMatch(/^\d+(?:\.\d{1,2})?$/)
    expect(parsePhotoForm(original, fields)).toMatchObject({
      ok: true,
      photo: original,
    })
  }
})

it("keeps Height 66.87 after Apply on a Rectangle cropped 25 percent per side", () => {
  const sourceRatio = 2687 / 3356
  const crop = { top: 0, right: 25000, bottom: 0, left: 25000 }
  const original = {
    ...photo,
    width: 2160,
    height: Math.round(2160 / croppedPhotoRatio(sourceRatio, crop)),
    crop,
  }
  const commit = parsePhotoForm(
    original,
    { ...photoFields(original), height: "66.85" },
    sourceRatio,
    "height"
  )
  if (!commit.ok) throw new Error(JSON.stringify(commit.errors))
  expect(commit.fields.height).toBe("66.87")
  const applied = parsePhotoForm(original, commit.fields, sourceRatio)
  if (!applied.ok) throw new Error(JSON.stringify(applied.errors))
  expect(photoFields(applied.photo)).toEqual(commit.fields)
})
