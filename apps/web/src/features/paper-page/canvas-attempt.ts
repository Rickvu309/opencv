import { QueryClient } from "@tanstack/react-query"
import { z } from "@workspace/domain"

import { ApiError } from "@/lib/api-error.ts"
import { runContractCommand } from "@/lib/contract-client.ts"
import {
  answerSent,
  type SentRecord,
  type WritingRecord,
} from "./canvas-save-record.ts"

const commands = new QueryClient()
const receiptSchema = z.object({
  generation: z.literal("package"),
  docId: z.string().uuid(),
  revision: z.string().uuid(),
  activityId: z.string().uuid().optional(),
})
export async function transmit(
  docId: string,
  attempt: SentRecord
): Promise<
  | { record: WritingRecord | null; revision: string; note: null }
  | { record: WritingRecord | null; revision: null; note: string }
> {
  try {
    const result = await runContractCommand(
      commands,
      "paper.canvas",
      attempt.input,
      { refresh: false, idempotencyKey: attempt.idempotencyKey }
    )
    const receipt = receiptSchema.parse(result)
    if (receipt.docId !== docId || receipt.docId !== attempt.input.batch.doc)
      throw new Error("The save receipt belongs to another document.")
    const record = await answerSent(docId, attempt, receipt)
    if (!record)
      throw new Error("The save receipt could not be kept on this computer.")
    return { record, revision: receipt.revision, note: null }
  } catch (error) {
    if (
      !(error instanceof ApiError) ||
      (error.status !== 400 && error.status !== 409)
    )
      throw error
    const record = await answerSent(docId, attempt, null, true)
    return {
      record,
      revision: null,
      note: error.message || "Paper could not save this line.",
    }
  }
}
export async function replayPending(docId: string, record: WritingRecord) {
  let current = record
  for (const attempt of record.sent) {
    if (
      !record.authorized.includes(attempt.attemptId) ||
      attempt.docId !== docId ||
      attempt.receipt ||
      attempt.refused
    )
      continue
    const replay = await transmit(docId, attempt)
    if (replay.record) current = replay.record
  }
  return current
}
