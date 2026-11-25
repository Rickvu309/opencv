import { z } from "zod"

import { profileSchema } from "./account.js"
import { queryContract, queryEntry } from "./contract.js"

const emptyInput = z.object({}).strict()

const activityFeedRowSchema = z
  .object({
    id: z.string(),
    createdAt: z.string().datetime(),
    actor: z.string(),
    command: z.string(),
    subjectKind: z.string(),
    subjectId: z.string(),
    summary: z.string(),
    undoneAt: z.string().datetime().nullable(),
    reversible: z.boolean(),
  })
  .strict()

export type ActivityFeedRow = z.output<typeof activityFeedRowSchema>

export const accountQueries = queryContract({
  "profile.get": queryEntry({ input: emptyInput, output: profileSchema }),
  "activity.list": queryEntry({
    input: z
      .object({
        subjectKind: z.string().min(1).optional(),
        subjectId: z.string().min(1).optional(),
      })
      .strict(),
    output: z.array(activityFeedRowSchema),
  }),
})
