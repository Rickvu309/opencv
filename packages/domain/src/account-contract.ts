import { z } from "zod"

import { profileSchema } from "./account.js"
import { queryContract, queryEntry } from "./contract.js"

const emptyInput = z.object({}).strict()

export const accountQueries = queryContract({
  "profile.get": queryEntry({ input: emptyInput, output: profileSchema }),
})
