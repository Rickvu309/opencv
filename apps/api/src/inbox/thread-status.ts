import { inboxStatusSchema } from "@workspace/domain"
import { z } from "zod"

export const threadStatusResult = z
  .object({
    id: z.string(),
    previousStatus: inboxStatusSchema,
    previousSnoozeUntil: z.string().datetime().nullable(),
  })
  .strict()

export type ThreadStatusResult = z.output<typeof threadStatusResult>

export const EMAIL_MOVED_SINCE = "This email moved again, so Undo was skipped"
