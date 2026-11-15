import type { QueryClient } from "@tanstack/react-query"
import {
  parsePaperId,
  nativeSyncOutputSchema,
  sameNativeProvenance,
  type CommandInput,
  type CommandOutput,
  type Commands,
} from "@workspace/domain"
import {
  emptyUpdate,
  openPaperClient,
  type PaperClient,
  type Stored,
} from "@workspace/paper-crdt"
import { ApiError } from "@/lib/api-error.ts"
import { runContractCommand } from "@/lib/contract-client.ts"
import { qualifiedPaperRead } from "@/lib/paper-qualification.ts"
import { endpoints } from "@/lib/requests.ts"
import { fromBase64, toBase64, type SyncStatus } from "@/lib/paper-sync.ts"
import {
  indexedDbStore,
  heldLocks,
  holdNativeTabLock,
  lockOf,
  type Orphan,
  type SyncStore,
} from "@/lib/paper-sync-store.ts"
import {
  requireNativeIdentity,
  nativeRecoveryScope,
  sameNativeSession,
  type NativeSyncIdentity,
} from "@/lib/paper-sync-identity.ts"
import {
  acknowledgeNativeJournal,
  appendNativeJournal,
  scanNativeJournals,
  validateNativeStored,
  type NativeCheckpoint,
} from "@/lib/paper-sync-recovery.ts"

export type NativeSyncTransport = (
  queryClient: QueryClient,
  name: "paper.nativeSync",
  input: CommandInput<Commands, "paper.nativeSync">,
  options: { refresh: false; signal: AbortSignal }
) => Promise<CommandOutput<Commands, "paper.nativeSync">>

export type NativeSessionOptions = {
  readonly identity: NativeSyncIdentity
  readonly currentIdentity: () => unknown
  readonly readAdmitted?: (identity: NativeSyncIdentity) => Promise<Stored>
  readonly queryClient: QueryClient
  readonly journal: Storage
  readonly store?: SyncStore
  readonly tabId?: string
  readonly run?: NativeSyncTransport
}

export function openNativePaperSync(options: NativeSessionOptions) {
  const identity = requireNativeIdentity(options.identity)
  const scope = nativeRecoveryScope(identity)
  const tabId = options.tabId ?? crypto.randomUUID()
  if (!tabId) throw new Error("Native tab identity required")
  const store = options.store ?? indexedDbStore(true)
  const command: NativeSyncTransport = options.run ?? runContractCommand
  const cancellation = new AbortController()
  const listeners = new Set<() => void>()
  let client: PaperClient | null = null
  let state: SyncStatus = "loading"
  let ready = false
  let destroyed = false
  let conflict = false
  let localError = false
  let version = 0
  let durableVersion = -1
  let acceptedVersion = -1
  let checkpoints: NativeCheckpoint[] = []
  let persistence = Promise.resolve()
  let exchange: Promise<void> | null = null
  let queued = false
  let closing = Promise.resolve()
  let detach = () => {}
  let releaseLock = () => {}
  const recoveryLocks: (() => void)[] = []
  const emit = () => {
    for (const listener of listeners) listener()
  }
  const destroy = () => {
    if (destroyed) return closing
    destroyed = true
    cancellation.abort()
    ready = false
    client = null
    detach()
    state = "refused"
    closing = persistence.then(async () => {
      releaseLock()
      for (const release of recoveryLocks.splice(0)) release()
      await store.close()
    })
    emit()
    listeners.clear()
    return closing
  }
  const active = () => {
    if (destroyed) return false
    if (sameNativeSession(identity, options.currentIdentity())) return true
    destroy()
    return false
  }
  const status = (): SyncStatus => {
    if (!active()) return "refused"
    if (conflict) return "stuck"
    if (localError) return "local"
    if (
      ready &&
      client &&
      durableVersion === version &&
      acceptedVersion === version &&
      !client.hasPending()
    )
      return "saved"
    return state
  }
  const failLocal = () => {
    localError = true
    emit()
  }
  const failRecovery = () => {
    conflict = true
    ready = false
    failLocal()
  }
  const persist = () => {
    if (!active() || !client) return persistence
    const snapshot = client.stored()
    const coveredVersion = version
    const covered = [...checkpoints]
    persistence = persistence.then(async () => {
      if (!active()) return
      try {
        await store.save(scope, tabId, snapshot)
        if (!active()) return
        acknowledgeNativeJournal(options.journal, identity, covered, "idb")
        durableVersion = coveredVersion
        localError = false
      } catch {
        failLocal()
      }
      emit()
    })
    return persistence
  }
  const remember = () => {
    if (!client) return
    try {
      checkpoints.push(
        appendNativeJournal(options.journal, identity, tabId, client.stored())
      )
    } catch {
      failRecovery()
    }
  }
  const flush = (): Promise<void> => {
    if (!active() || !ready || conflict || !client) return Promise.resolve()
    if (exchange) {
      queued = true
      return exchange
    }
    queued = false
    acceptedVersion = -1
    const live = client
    const sent = live.prepare()
    const sentVersion = version
    const covered = [...checkpoints]
    state = "saving"
    emit()
    exchange = (async () => {
      try {
        const raw = await command(
          options.queryClient,
          "paper.nativeSync",
          {
            docId: parsePaperId(identity.docId),
            writer: identity.writer,
            provenance: identity.provenance,
            epoch: sent.epoch,
            update: toBase64(sent.update),
            stateVector: toBase64(sent.stateVector),
            ...(sent.basedOn === undefined ? {} : { basedOn: sent.basedOn }),
          },
          { refresh: false, signal: cancellation.signal }
        )
        if (!active()) return
        const parsed = nativeSyncOutputSchema.safeParse(raw)
        if (!parsed.success) {
          failRecovery()
          return
        }
        const output = parsed.data
        const unchanged = version === sentVersion
        const receipt = live.receive(sent, {
          ...output,
          update: fromBase64(output.update),
          stateVector: fromBase64(output.stateVector),
        })
        if (receipt.failed || receipt.reset) {
          conflict = true
          ready = false
          return
        }
        if (!receipt.stale && unchanged && !live.hasPending()) {
          acceptedVersion = version
          try {
            acknowledgeNativeJournal(
              options.journal,
              identity,
              covered,
              "server"
            )
          } catch {
            failRecovery()
          }
        }
        await persist()
      } catch (error) {
        if (active()) {
          if (
            error instanceof ApiError &&
            error.status >= 400 &&
            error.status < 500 &&
            error.status !== 408 &&
            error.status !== 429
          )
            failRecovery()
          else state = "offline"
        }
      } finally {
        exchange = null
        emit()
        if (queued && active() && ready && !conflict) await flush()
      }
    })()
    return exchange
  }
  const initialized = (async () => {
    try {
      if (!active()) return
      releaseLock = await holdNativeTabLock(scope, tabId)
      if (!active()) {
        releaseLock()
        return
      }
      const held = await heldLocks()
      if (!active()) return
      if (!held) throw new Error("Native recovery needs a readable lock scan")
      const discovered = await store.load(scope, tabId)
      if (!active()) return
      const discoveredJournals = scanNativeJournals(
        options.journal,
        identity
      ).filter(
        (entry) =>
          entry.tabId === tabId || !held.has(lockOf(scope, entry.tabId))
      )
      const candidates = new Set([
        ...discovered.orphans
          .filter((entry) => !held.has(lockOf(scope, entry.tabId)))
          .map((entry) => entry.tabId),
        ...discoveredJournals.map((entry) => entry.tabId),
      ])
      candidates.delete(tabId)
      for (const orphanTab of candidates) {
        if (orphanTab === tabId) continue
        const release = await holdNativeTabLock(scope, orphanTab)
        if (!active()) {
          release()
          return
        }
        recoveryLocks.push(release)
      }
      const loaded = await store.load(scope, tabId)
      if (!active()) return
      const orphans: Orphan[] = []
      for (const orphanTab of candidates) {
        const current = await store.load(scope, orphanTab)
        if (!active()) return
        if (current.own) orphans.push({ tabId: orphanTab, stored: current.own })
      }
      const journals = scanNativeJournals(options.journal, identity).filter(
        (entry) => entry.tabId === tabId || candidates.has(entry.tabId)
      )
      const readAdmitted = async () => {
        if (options.readAdmitted) return options.readAdmitted(identity)
        const view = await qualifiedPaperRead(
          "paper.get",
          endpoints.paperDoc(identity.docId),
          {
            ownerId: identity.ownerId,
            sessionId: identity.sessionId,
            writer: identity.writer,
            signal: cancellation.signal,
          }
        )
        if (!active()) throw new Error("Native read session changed")
        if (
          view.id !== identity.docId ||
          view.paper.version !== 4 ||
          !sameNativeProvenance(
            view.nativeBasis?.provenance,
            identity.provenance
          )
        )
          throw new Error("Native recovery read does not match its identity")
        const reply = nativeSyncOutputSchema.parse(
          await command(
            options.queryClient,
            "paper.nativeSync",
            {
              docId: identity.docId,
              writer: identity.writer,
              provenance: identity.provenance,
              epoch: 0,
              update: "",
              stateVector: "",
            },
            { refresh: false, signal: cancellation.signal }
          )
        )
        if (
          !active() ||
          reply.stale ||
          !sameNativeProvenance(reply.provenance, identity.provenance)
        )
          throw new Error("Native bootstrap refused")
        return {
          epoch: reply.epoch,
          revision: reply.revision,
          provenance: reply.provenance,
          server: fromBase64(reply.update),
          pending: emptyUpdate(),
        }
      }
      const admitted = validateNativeStored(identity, await readAdmitted())
      if (!active()) return
      for (const stored of [
        loaded.own,
        ...orphans.map((entry) => entry.stored),
      ])
        if (stored) validateNativeStored(identity, stored)
      const latest = new Map(
        journals.map((entry) => [entry.tabId, entry.states.at(-1)])
      )
      const states = [
        latest.get(tabId) ?? loaded.own,
        ...orphans.map((entry) => latest.get(entry.tabId) ?? entry.stored),
        ...journals
          .filter(
            (entry) =>
              entry.tabId !== tabId &&
              !orphans.some((orphan) => orphan.tabId === entry.tabId)
          )
          .map((entry) => entry.states.at(-1)),
      ]
        .filter(
          (stored): stored is Stored => stored !== null && stored !== undefined
        )
        .map((stored) => validateNativeStored(identity, stored))
      client = openPaperClient(admitted, { provenance: identity.provenance })
      for (const stored of states) {
        const result = client.adopt(stored)
        if (result.failed || !result.adopted)
          throw new Error("Native recovery conflict retained")
      }
      checkpoints = journals.flatMap((entry) => entry.checkpoints)
      remember()
      await persist()
      if (!active() || localError) return
      for (const orphan of orphans) {
        if (!active()) return
        await store.remove(scope, orphan.tabId)
      }
      if (!active()) return
      detach = client.subscribe((change) => {
        if (!active()) return
        version += 1
        state = "saving"
        if (change === "local") {
          remember()
          if (exchange) queued = true
        }
        void persist()
        emit()
      })
      ready = true
      await flush()
    } catch {
      if (active()) {
        conflict = true
        ready = false
        client = null
        emit()
      }
    }
  })()
  return {
    initialized,
    status,
    ready: () => active() && ready && !conflict,
    client: () => (active() && ready && !conflict ? client : null),
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    flush,
    persist,
    destroy,
  }
}
