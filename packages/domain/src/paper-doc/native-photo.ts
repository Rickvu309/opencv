import { z } from "zod"
import { paperPhotoFileId, paperPhotoValueSchema } from "../paper.js"
import { nodeIdSchema } from "./nodes.js"

const edge = z.number().int().min(0).max(99999)
const distance = z.number().int().min(0).max(31680)
export const layoutPhotoSchema = z
  .object({
    id: nodeIdSchema,
    type: z.literal("photo"),
    source: paperPhotoValueSchema.refine(
      (value) => paperPhotoFileId(value) !== null,
      "Photo requires an owned file reference"
    ),
    width: z.number().int().min(240).max(31680),
    height: z.number().int().min(240).max(31680),
    crop: z
      .object({ top: edge, right: edge, bottom: edge, left: edge })
      .strict()
      .refine(
        (crop) =>
          crop.top + crop.bottom < 100000 && crop.left + crop.right < 100000,
        "Photo crop must retain visible source area"
      ),
    rotation: z.number().int().min(0).max(359),
    shape: z.enum(["rectangle", "rounded", "circle"]),
    placement: z.discriminatedUnion("kind", [
      z
        .object({
          kind: z.literal("block"),
          alignment: z.enum(["left", "center", "right"]),
        })
        .strict(),
      z
        .object({ kind: z.literal("wrap"), side: z.enum(["left", "right"]) })
        .strict(),
    ]),
    spacing: z
      .object({
        top: distance,
        right: distance,
        bottom: distance,
        left: distance,
      })
      .strict(),
    alt: z.string().max(2000),
  })
  .strict()
  .refine(
    (photo) => photo.shape !== "circle" || photo.width === photo.height,
    "Circular photos require equal dimensions"
  )
export type LayoutPhoto = z.infer<typeof layoutPhotoSchema>
export function photoBounds(photo: LayoutPhoto) {
  const angle = (photo.rotation * Math.PI) / 180
  return {
    width:
      Math.abs(photo.width * Math.cos(angle)) +
      Math.abs(photo.height * Math.sin(angle)),
    height:
      Math.abs(photo.width * Math.sin(angle)) +
      Math.abs(photo.height * Math.cos(angle)),
  }
}
