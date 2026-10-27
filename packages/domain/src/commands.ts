import { z } from "zod"

export const THREAD_COMMANDS = {
  create: "threads.create",
  rename: "threads.rename",
  delete: "threads.delete",
  postMessage: "threads.postMessage",
} as const

export type ThreadCommandName =
  (typeof THREAD_COMMANDS)[keyof typeof THREAD_COMMANDS]

/**
 * Coach-allowed but excluded from the tool surface (ADR-0007): the stream
 * is the Coach's voice, and this Command means the User posted a message.
 */
export const COACH_VOICE_COMMAND = THREAD_COMMANDS.postMessage

export const reversalDescriptorSchema = z.object({
  possible: z.boolean(),
  description: z.string(),
  command: z.string().optional(),
  /** Input for `command` when this descriptor is attached to a receipt. */
  input: z.unknown().optional(),
})

export type ReversalDescriptor = z.infer<typeof reversalDescriptorSchema>
