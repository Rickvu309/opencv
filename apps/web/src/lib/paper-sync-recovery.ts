import { z } from "zod"
import {
  nativeProvenanceSchema,
  sameNativeProvenance,
} from "@workspace/domain/paper-doc"
import {
  emptyUpdate,
  openRichPaperClient,
  type Stored,
} from "@workspace/paper-crdt"
import { fromBase64, toBase64 } from "@/lib/paper-sync-bytes.ts"
import {
  nativeRecoveryScope,
  type NativeSyncIdentity,
} from "@/lib/paper-sync-identity.ts"

const snapshotSchema = z
  .object({
    provenance: nativeProvenanceSchema,
    epoch: z.number().int().positive(),
    revision: z.number().int().nonnegative(),
    server: z.string(),
    pending: z.string(),
  })
  .strict()
const recordSchema = z
  .object({
    next: z.number().int().nonnegative(),
    entries: z.array(
      z
        .object({
          seq: z.number().int().positive(),
          snapshot: snapshotSchema,
          idb: z.boolean(),
          server: z.boolean(),
        })
        .strict()
    ),
  })
  .strict()
  .superRefine((record, ctx) => {
    let prior = 0
    for (const entry of record.entries) {
      if (entry.seq <= prior || entry.seq > record.next)
        ctx.addIssue({
          code: "custom",
          message: "Invalid native journal sequence",
        })
      prior = entry.seq
    }
  })
type NativeRecord = z.infer<typeof recordSchema>
export type NativeCheckpoint = {
  readonly key: string
  readonly seq: number
  readonly snapshot: string
}
export type NativeRecovery = {
  readonly key: string
  readonly tabId: string
  readonly checkpoints: NativeCheckpoint[]
  readonly states: Stored[]
}

export function validateNativeStored(
  identity: NativeSyncIdentity,
  stored: Stored
): Stored {
  if (
    !sameNativeProvenance(identity.provenance, stored.provenance) ||
    !Number.isInteger(stored.epoch) ||
    stored.epoch <= 0 ||
    !Number.isInteger(stored.revision) ||
    stored.revision === undefined ||
    stored.revision < 0
  )
    throw new Error("Incompatible native recovery retained")
  if (identity.provenance.schemaRevision !== 2)
    throw new Error("Incompatible native recovery retained")
  openRichPaperClient(stored, { provenance: identity.provenance }).destroy()
  openRichPaperClient(
    { ...stored, pending: emptyUpdate() },
    { provenance: identity.provenance }
  ).destroy()
  return stored
}

const prefixOf = (identity: NativeSyncIdentity) =>
  `paper-native-journal:${nativeRecoveryScope(identity)}:`
export const nativeJournalKey = (identity: NativeSyncIdentity, tabId: string) =>
  `${prefixOf(identity)}${encodeURIComponent(tabId)}`

function read(
  storage: Storage,
  key: string,
  identity: NativeSyncIdentity,
  required = false
): NativeRecord {
  const raw = storage.getItem(key)
  if (required && raw === null)
    throw new Error("Native journal disappeared during scan")
  const record =
    raw === null
      ? { next: 0, entries: [] }
      : recordSchema.parse(JSON.parse(raw))
  for (const entry of record.entries) decode(identity, entry.snapshot)
  return record
}

function decode(
  identity: NativeSyncIdentity,
  snapshot: z.infer<typeof snapshotSchema>
): Stored {
  return validateNativeStored(identity, {
    ...snapshot,
    server: fromBase64(snapshot.server),
    pending: fromBase64(snapshot.pending),
  })
}

export function scanNativeJournals(
  storage: Storage,
  identity: NativeSyncIdentity
): NativeRecovery[] {
  const found: NativeRecovery[] = []
  const prefix = prefixOf(identity)
  const length = storage.length
  const seen = new Set<string>()
  for (let at = 0; at < length; at += 1) {
    const key = storage.key(at)
    if (key === null || seen.has(key))
      throw new Error("Native journal scan incomplete")
    seen.add(key)
    if (!key.startsWith(prefix)) continue
    const tabId = decodeURIComponent(key.slice(prefix.length))
    if (!tabId) throw new Error("Native journal tab identity missing")
    const record = read(storage, key, identity, true)
    found.push({
      key,
      tabId,
      checkpoints: record.entries.map((entry) => ({
        key,
        seq: entry.seq,
        snapshot: JSON.stringify(entry.snapshot),
      })),
      states: record.entries.map((entry) => decode(identity, entry.snapshot)),
    })
  }
  if (storage.length !== length) throw new Error("Native journal scan changed")
  return found
}

export function appendNativeJournal(
  storage: Storage,
  identity: NativeSyncIdentity,
  tabId: string,
  stored: Stored
): NativeCheckpoint {
  validateNativeStored(identity, stored)
  const key = nativeJournalKey(identity, tabId)
  const record = read(storage, key, identity)
  const snapshot = snapshotSchema.parse({
    ...stored,
    server: toBase64(stored.server),
    pending: toBase64(stored.pending),
  })
  const seq = record.next + 1
  storage.setItem(
    key,
    JSON.stringify({
      next: seq,
      entries: [{ seq, snapshot, idb: false, server: false }],
    })
  )
  return { key, seq, snapshot: JSON.stringify(snapshot) }
}

export function acknowledgeNativeJournal(
  storage: Storage,
  identity: NativeSyncIdentity,
  checkpoints: readonly NativeCheckpoint[],
  kind: "idb" | "server"
) {
  for (const key of new Set(checkpoints.map((checkpoint) => checkpoint.key))) {
    if (!key.startsWith(prefixOf(identity)))
      throw new Error("Foreign native checkpoint")
    const record = read(storage, key, identity, true)
    for (const checkpoint of checkpoints.filter((entry) => entry.key === key)) {
      const entry = record.entries.find(
        (candidate) => candidate.seq === checkpoint.seq
      )
      if (
        checkpoint.seq > record.next ||
        (entry && checkpoint.snapshot !== JSON.stringify(entry.snapshot))
      )
        throw new Error("Native checkpoint changed before acknowledgement")
    }
    const entries = record.entries.map((entry) =>
      checkpoints.some(
        (checkpoint) =>
          checkpoint.key === key &&
          checkpoint.seq === entry.seq &&
          checkpoint.snapshot === JSON.stringify(entry.snapshot)
      )
        ? { ...entry, [kind]: true }
        : entry
    )
    storage.setItem(
      key,
      JSON.stringify({
        ...record,
        entries: entries.filter((entry) => !entry.idb || !entry.server),
      })
    )
  }
}
