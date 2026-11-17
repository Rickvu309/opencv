import { z } from "zod"

export const tableBordersSchema = z
  .object({
    mode: z.enum(["none", "all", "outer"]),
    color: z.union([z.literal("default"), z.string().regex(/^#[0-9A-F]{6}$/)]),
    weight: z.enum(["thin", "medium"]),
  })
  .strict()
export type TableBorders = z.infer<typeof tableBordersSchema>

export function resolveTableBorders(borders: TableBorders | undefined) {
  return {
    mode: borders?.mode ?? "all",
    color: borders
      ? borders.color === "default"
        ? "#000000"
        : borders.color
      : "#B5B5B5",
    size: borders?.weight === "medium" ? 12 : 6,
  }
}
