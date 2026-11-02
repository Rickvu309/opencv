import { z } from "zod"

import { paperIdSchema } from "../ids.js"

const PAPER_SYNC_UPDATE_CAP = 2_000_000
const PAPER_SYNC_STATE_VECTOR_CAP = 65_536

const BASE64 =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/

function bytesText(cap: number) {
  return z.string().max(cap).regex(BASE64, "Expected base64 bytes")
}

export const paperSyncInputSchema = z
  .object({
    docId: paperIdSchema,
    epoch: z.number().int().min(0),
    update: bytesText(PAPER_SYNC_UPDATE_CAP),
    stateVector: bytesText(PAPER_SYNC_STATE_VECTOR_CAP),
  })
  .strict()

export const paperSyncOutputSchema = z
  .object({
    epoch: z.number().int().min(1),
    revision: z.number().int(),
    reset: z.boolean(),
    update: z.string(),
    stateVector: z.string(),
  })
  .strict()
