import { storedHasPending, type Stored } from "@workspace/paper-crdt"
import type { PaperId } from "@workspace/domain"
import { recoverJournals } from "@/lib/paper-sync-journal.ts"
import { defaultStore, type SyncStore } from "@/lib/paper-sync-store.ts"

export function openJournal(given: Storage | null | undefined): {
  storage: Storage | null
  denied: boolean
} {
  if (given === null) return { storage: null, denied: true }
  if (given) return { storage: given, denied: false }
  try {
    if (typeof localStorage === "undefined")
      return { storage: null, denied: false }
    return { storage: localStorage, denied: false }
  } catch {
    return { storage: null, denied: true }
  }
}

export async function legacyRecoveryPending(
  docId: PaperId,
  tabId: string,
  journal: Storage | null,
  givenStore?: SyncStore
): Promise<boolean> {
  const store = givenStore ?? defaultStore()
  try {
    const loaded = await store.load(docId, tabId, { includeHeld: true })
    const states = [
      loaded.own,
      ...loaded.orphans.map(({ stored }) => stored),
    ].filter((stored): stored is Stored => stored !== null)
    if (states.some((stored) => storedHasPending(stored))) return true
    if (
      journal &&
      recoverJournals(journal, docId).some(
        (record) =>
          !record.readable ||
          record.states.some((stored) => storedHasPending(stored))
      )
    )
      return true
    return false
  } catch {
    return true
  } finally {
    if (!givenStore) await store.close()
  }
}
