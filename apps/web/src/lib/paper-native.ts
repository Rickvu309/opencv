import { NATIVE_WRITER, type PaperId } from "@workspace/domain"
import type { PaperClient } from "@workspace/paper-crdt"
import type { QueryClient } from "@tanstack/react-query"

import { runContractCommand } from "./contract-client.ts"
import { paperGetKey } from "./paper-reader.ts"
import { legacyRecoveryPending, type SyncStatus } from "./paper-sync.ts"

export async function enableLetterUnderline(
  docId: PaperId,
  client: PaperClient | null,
  status: SyncStatus,
  queryClient: QueryClient
) {
  if (
    !client ||
    status !== "saved" ||
    client.hasPending() ||
    client.provenance ||
    client.document()?.kind !== "letter"
  )
    throw new Error("Save this Letter's changes before enabling underline.")
  let journal: Storage
  try {
    journal = window.localStorage
  } catch {
    throw new Error(
      "This device's saved changes could not be checked. Underline was not enabled."
    )
  }
  if (await legacyRecoveryPending(docId, "", journal))
    throw new Error(
      "This Letter has changes waiting on this device. Open and save them before enabling underline."
    )
  if (client.hasPending())
    throw new Error("Save this Letter's changes before enabling underline.")
  const result = await runContractCommand(queryClient, "paper.migrateNative", {
    docId,
    epoch: client.epoch,
    basedOn: client.revision,
    writer: NATIVE_WRITER,
  })
  queryClient.setQueryData(paperGetKey(docId), result)
  return result
}
