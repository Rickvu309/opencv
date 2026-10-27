import { z } from "zod"

export const reversalDescriptorSchema = z.object({
  possible: z.boolean(),
  description: z.string(),
  command: z.string().optional(),
  /** Input for `command` when this descriptor is attached to a receipt. */
  input: z.unknown().optional(),
})

export type ReversalDescriptor = z.infer<typeof reversalDescriptorSchema>
