import { z } from "zod"

export const tableBordersSchema = z
  .object({
    mode: z.enum(["none", "all", "outer"]),
    color: z.union([z.literal("default"), z.string().regex(/^#[0-9A-F]{6}$/)]),
    weight: z.enum(["thin", "medium"]),
  })
  .strict()
