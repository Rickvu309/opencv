import { useSyncExternalStore } from "react"
import { useQueryClient, type QueryClient } from "@tanstack/react-query"
import {
  openPaperClient,
  mergedUpdate,
  updateSince,
  type ClientSyncReply,
  type PaperClient,
  type Stored,
} from "@workspace/paper-crdt"
import {
  NATIVE_WRITER,
  sameNativeProvenance,
  type NativeProvenance,
  type PaperId,
} from "@workspace/domain"

import { queryKey, runContractCommand } from "@/lib/contract-client.ts"
import { ApiError } from "@/lib/api-error.ts"
import {
  appendJournal,
  journalTip,
  journalScope,
  recoverJournals,
  mergeJournal,
  noteJournal,
  type JournalResult,
} from "@/lib/paper-sync-journal.ts"
import {
  defaultStore,
  heldLocks,
  holdTabLock,
  lockOf,
  type SyncStore,
} from "@/lib/paper-sync-store.ts"

import {
  openJournal,
  legacyRecoveryPending,
} from "@/lib/paper-sync-recovery.ts"

export { legacyRecoveryPending } from "@/lib/paper-sync-recovery.ts"
import { toBase64, fromBase64 } from "@/lib/paper-sync-codec.ts"
export { toBase64, fromBase64 } from "@/lib/paper-sync-codec.ts"
export { indexedDbStore } from "@/lib/paper-sync-store.ts"

export type SyncStatus =
  | "loading"
  | "saved"
  | "saving"
  | "offline"
  | "contended"
  | "refused"
  | "stuck"
  | "local"

export const SYNC_LABEL: Record<SyncStatus, string> = {
  loading: "Loading",
  saved: "Saved",
  saving: "Saving",
  offline: "Offline, retrying",
  contended: "Busy, retrying",
  refused: "Not saved. Reload the page",
  stuck: "Not merged. Your changes are kept",
  local: "Not kept on this device",
}

const DEBOUNCE_MS = 400
const MAX_WAIT_MS = 2000
const BACKOFF_MS = [1000, 2000, 4000, 8000, 16_000, 30_000]
const KEEPALIVE_LIMIT = 60_000
const MAX_STALE_RETRIES = 6
const CONTENDED_WAIT_MS = 500
const TAB_KEY = "paper-sync-tab"

export type Timers = {
  setTimeout: (run: () => void, ms: number) => unknown
  clearTimeout: (handle: unknown) => void
  now: () => number
}

const realTimers: Timers = {
  setTimeout(run, ms) {
    return setTimeout(run, ms)
  },
  clearTimeout: (handle) => clearTimeout(handle as never),
  now: () => Date.now(),
}

async function tabIdentity(docId: string): Promise<string> {
  if (typeof sessionStorage === "undefined") return crypto.randomUUID()
  const known = sessionStorage.getItem(TAB_KEY)
  const held = known ? await heldLocks() : null
  if (known && !held?.has(lockOf(docId, known))) return known
  const made = crypto.randomUUID()
  sessionStorage.setItem(TAB_KEY, made)
  return made
}

class Contended extends Error {}

function isRefusal(error: unknown) {
  return (
    error instanceof ApiError &&
    error.status >= 400 &&
    error.status < 500 &&
    error.status !== 408 &&
    error.status !== 429
  )
}

function isGoneLetter(error: unknown) {
  return error instanceof ApiError && error.code === "NOT_FOUND"
}

function replyOf(output: {
  provenance?: NativeProvenance
  epoch: number
  revision: number
  reset: boolean
  stale: boolean
  update: string
  stateVector: string
}): ClientSyncReply {
  return {
    ...(output.provenance ? { provenance: output.provenance } : {}),
    epoch: output.epoch,
    revision: output.revision,
    reset: output.reset,
    stale: output.stale,
    update: fromBase64(output.update),
    stateVector: fromBase64(output.stateVector),
  }
}

export type PaperSync = {
  readonly docId: PaperId
  client(): PaperClient | null
  ready(): boolean
  status(): SyncStatus
  generation(): number
  subscribe(listener: () => void): () => void
  poke(): void
  noteRevision(revision: number): void
  flush(): void
  destroy(): void
}

export type SyncOptions = {
  readonly provenance?: NativeProvenance
  readonly legacyStore?: SyncStore
  readonly store?: SyncStore
  readonly timers?: Timers
  readonly tabId?: string
  readonly journal?: Storage | null
  readonly run?: typeof runContractCommand
}

export function openPaperSync(
  docId: PaperId,
  queryClient: QueryClient,
  options: SyncOptions = {}
): PaperSync {
  const provenance = options.provenance
  const localDocId = provenance ? `native-v4-r1:${docId}` : docId
  const store = options.store ?? defaultStore(provenance !== undefined)
  const timers = options.timers ?? realTimers
  const command = options.run ?? runContractCommand
  const openedJournal = openJournal(options.journal)
  const journal = openedJournal.storage
  const journalDenied = openedJournal.denied
  let tabId = options.tabId ?? ""
  let releaseLock: () => void = () => {}
  let recoveredJournals: ReturnType<typeof recoverJournals> = []
  let canClearRecovered = false
  const blockedJournals = new Set<string>()
  const journalId = () => journalScope(localDocId, tabId)
  const journalCheckpoint = () => [
    ...recoveredJournals
      .filter(
        ({ id }) =>
          !blockedJournals.has(id) && (canClearRecovered || id === journalId())
      )
      .map(({ id, seq }) => ({ id, seq })),
    {
      id: journalId(),
      seq:
        journal && !blockedJournals.has(journalId())
          ? journalTip(journal, journalId())
          : 0,
    },
  ]
  let version = 0
  let durableVersion = -1
  let acceptedVersion = -1
  let saving = false
  let saveAgain = false
  let saveWaiters: (() => void)[] = []
  const listeners = new Set<() => void>()
  let client: PaperClient | null = null
  let ready = false
  let state: SyncStatus = "loading"
  let localFailed = false
  let generation = 0
  let inFlight = false
  let rerun = false
  let noted = false
  let destroyed = false
  let forgotten = false
  let failures = 0
  let replied = false
  let waitingOrphans: { readonly tabId: string; readonly stored: Stored }[] = []
  let lastKeepalive = ""
  let debounce: unknown = null
  let maxWait: unknown = null
  let retry: unknown = null
  let unsubscribeClient: () => void = () => {}

  const emit = () => {
    for (const listener of [...listeners]) listener()
  }
  const setStatus = (next: SyncStatus) => {
    if (state === next) return
    state = next
    emit()
  }
  const clear = (handle: unknown) => {
    if (handle !== null) timers.clearTimeout(handle)
  }

  const markJournal = (result: JournalResult) => {
    if (result === "kept") return
    localFailed = true
  }

  const rememberLocal = () => {
    if (!client) return
    if (!journal) {
      if (journalDenied) localFailed = true
      return
    }
    const update = updateSince(client.ydoc, new Uint8Array())
    if (!update || update.byteLength === 0) return
    markJournal(appendJournal(journal, journalId(), update, client.stored()))
  }

  const canShowSaved = () =>
    client !== null &&
    durableVersion === version &&
    acceptedVersion === version &&
    !client.hasPending() &&
    !localFailed &&
    blockedJournals.size === 0

  const pumpSave = () => {
    if (forgotten || !client || !tabId || (provenance && !client.document())) {
      const pending = saveWaiters
      saveWaiters = []
      saving = false
      saveAgain = false
      for (const resolve of pending) resolve()
      return
    }
    saving = true
    saveAgain = false
    const pending = saveWaiters
    saveWaiters = []
    const checkpoint = journalCheckpoint()
    const versionOfSnapshot = version
    const snapshot = client.stored()
    void store
      .save(localDocId, tabId, snapshot)
      .then(
        () => {
          durableVersion = versionOfSnapshot
          if (localFailed) {
            localFailed = false
            emit()
          }
          if (journal)
            for (const { id, seq } of checkpoint)
              markJournal(noteJournal(journal, id, "idb", seq))
          if (state === "saving" && canShowSaved()) setStatus("saved")
        },
        () => {
          if (!localFailed) {
            localFailed = true
            emit()
          }
        }
      )
      .finally(() => {
        saving = false
        for (const resolve of pending) resolve()
        if ((saveAgain || saveWaiters.length > 0) && !destroyed) pumpSave()
      })
  }

  const save = () => {
    if (forgotten || !client || !tabId) return Promise.resolve()
    return new Promise<void>((resolve) => {
      saveWaiters.push(resolve)
      if (saving) saveAgain = true
      else pumpSave()
    })
  }

  const body = (sent: ReturnType<PaperClient["prepare"]>) => ({
    docId,
    epoch: sent.epoch,
    update: toBase64(sent.update),
    stateVector: toBase64(sent.stateVector),
    ...(sent.basedOn === undefined ? {} : { basedOn: sent.basedOn }),
  })

  const send = (
    sent: ReturnType<PaperClient["prepare"]>,
    requestOptions: { refresh: false; keepalive?: boolean }
  ) =>
    provenance
      ? command(
          queryClient,
          "paper.nativeSync",
          { ...body(sent), writer: NATIVE_WRITER, provenance },
          requestOptions
        )
      : command(queryClient, "paper.sync", body(sent), requestOptions)

  const exchange = async () => {
    const live = client!
    const sent = live.prepare()
    const covered = journalCheckpoint()
    void save()
    const output = await send(sent, {
      refresh: false,
    })
    const receipt = live.receive(sent, replyOf(output))
    if (receipt.failed) return receipt
    if (!receipt.stale && !live.hasPending()) acceptedVersion = version
    if (receipt.reset) generation += 1
    ready = true
    replied = true
    forgotten = false
    void save()
    if (journal && !receipt.stale && !receipt.reset)
      for (const { id, seq } of covered)
        markJournal(noteJournal(journal, id, "server", seq))
    return receipt
  }

  const run = async () => {
    if (destroyed || !client) return
    if (inFlight) {
      rerun = true
      return
    }
    inFlight = true
    clear(debounce)
    clear(maxWait)
    clear(retry)
    debounce = null
    maxWait = null
    retry = null
    if (client.hasPending() || state !== "saved") setStatus("saving")
    try {
      let stuck = blockedJournals.size > 0
      for (let attempt = 0; ; attempt += 1) {
        const receipt = await exchange()
        if (receipt.failed) {
          stuck = true
          break
        }
        if (!receipt.stale) break
        if (attempt >= MAX_STALE_RETRIES) {
          throw new Contended("The server kept moving")
        }
      }
      failures = 0
      if (await adoptWaiting()) stuck = true
      if (stuck) setStatus("stuck")
      else if (client.hasPending()) schedule()
      else setStatus(canShowSaved() ? "saved" : "saving")
      emit()
    } catch (error) {
      if (isRefusal(error)) {
        if (isGoneLetter(error) && !client.hasPending()) {
          forgotten = true
          void store.removeDoc(localDocId).catch(() => {})
        }
        setStatus("refused")
      } else if (error instanceof Contended) {
        setStatus("contended")
        retry = timers.setTimeout(
          () => {
            retry = null
            void run()
          },
          Math.round(CONTENDED_WAIT_MS * (1 + Math.random() * 3))
        )
      } else {
        setStatus("offline")
        const wait = BACKOFF_MS[Math.min(failures, BACKOFF_MS.length - 1)]!
        failures += 1
        retry = timers.setTimeout(
          () => {
            retry = null
            void run()
          },
          Math.round(wait * (0.75 + Math.random() * 0.5))
        )
      }
    } finally {
      inFlight = false
      if (!destroyed && (rerun || noted)) {
        rerun = false
        noted = false
        queueMicrotask(() => void run())
      }
    }
  }

  function backingOff() {
    return retry !== null && (state === "offline" || state === "contended")
  }

  async function adoptWaiting() {
    if (!replied || !client || waitingOrphans.length === 0) return false
    const waiting = waitingOrphans
    waitingOrphans = []
    let failed = false
    const adopted = waiting.filter((orphan) => {
      const adoption = client!.adopt(orphan.stored)
      if (adoption.failed) failed = true
      return adoption.adopted
    })
    await save()
    if (!localFailed) {
      for (const orphan of adopted) {
        await store.remove(localDocId, orphan.tabId).catch(() => {})
      }
    }
    if (adopted.length > 0 && !failed && client.hasPending()) schedule()
    return failed
  }

  function schedule() {
    if (destroyed || !client) return
    if (state !== "offline" && state !== "contended" && state !== "refused") {
      setStatus("saving")
    }
    clear(debounce)
    debounce = timers.setTimeout(() => {
      debounce = null
      if (!backingOff()) void run()
    }, DEBOUNCE_MS)
    if (maxWait === null) {
      maxWait = timers.setTimeout(() => {
        maxWait = null
        if (!backingOff()) void run()
      }, MAX_WAIT_MS)
    }
  }

  const keepaliveFlush = () => {
    if (!client) return
    void save()
    if (inFlight || !client.hasPending()) return
    const sent = client.prepare()
    const payload = {
      ...body(sent),
      ...(provenance ? { writer: NATIVE_WRITER, provenance } : {}),
    }
    if (JSON.stringify(payload).length > KEEPALIVE_LIMIT) return
    if (payload.update === lastKeepalive) return
    lastKeepalive = payload.update
    void send(sent, {
      refresh: false,
      keepalive: true,
    }).catch(() => {})
  }

  const onVisibility = () => {
    if (document.visibilityState === "hidden") keepaliveFlush()
  }
  const onFocus = () => void run()
  const stopQueryWatch = queryClient.getQueryCache().subscribe((event) => {
    const data = event.query.state.data as
      { contentVersion?: number } | undefined
    if (
      JSON.stringify(event.query.queryKey) ===
        JSON.stringify(
          queryKey({
            query: "paper.get",
            input: { docId, writer: NATIVE_WRITER },
          })
        ) &&
      typeof data?.contentVersion === "number"
    ) {
      api.noteRevision(data.contentVersion)
    }
  })
  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", keepaliveFlush)
    window.addEventListener("focus", onFocus)
    window.addEventListener("online", onFocus)
    document.addEventListener("visibilitychange", onVisibility)
  }

  const api: PaperSync = {
    docId,
    client: () => client,
    ready: () => ready,
    status: () =>
      localFailed && (state === "saved" || state === "saving")
        ? "local"
        : state,
    generation: () => generation,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    poke: () => void run(),
    noteRevision(revision) {
      if (!client || !ready || revision <= client.revision) return
      if (inFlight) noted = true
      else void run()
    },
    flush: keepaliveFlush,
    destroy() {
      if (destroyed) return
      keepaliveFlush()
      destroyed = true
      for (const handle of [debounce, maxWait, retry]) clear(handle)
      unsubscribeClient()
      stopQueryWatch()
      releaseLock()
      void store.close()
      if (typeof window !== "undefined") {
        window.removeEventListener("pagehide", keepaliveFlush)
        window.removeEventListener("focus", onFocus)
        window.removeEventListener("online", onFocus)
        document.removeEventListener("visibilitychange", onVisibility)
      }
      listeners.clear()
    },
  }

  void (async () => {
    if (!tabId) tabId = await tabIdentity(localDocId)
    if (destroyed) return
    releaseLock = holdTabLock(localDocId, tabId)
    if (
      provenance &&
      (await legacyRecoveryPending(docId, tabId, journal, options.legacyStore))
    ) {
      setStatus("stuck")
      return
    }
    const loaded = await store.load(localDocId, tabId)
    if (destroyed) return
    const allLocal = [
      loaded.own,
      ...loaded.orphans.map(({ stored }) => stored),
    ].filter((stored): stored is Stored => stored !== null)
    if (
      allLocal.some(
        (stored) => !sameNativeProvenance(stored.provenance, provenance)
      )
    ) {
      setStatus("stuck")
      return
    }
    const lead = loaded.own ?? loaded.orphans[0]?.stored ?? null
    const rest = loaded.own ? loaded.orphans : loaded.orphans.slice(1)
    const held = await heldLocks()
    canClearRecovered = held !== null
    recoveredJournals = journal
      ? recoverJournals(journal, localDocId).filter(
          ({ id }) =>
            id === journalId() || held === null || !held.has(`paper-sync:${id}`)
        )
      : []
    for (const recovered of recoveredJournals) {
      if (
        !recovered.readable ||
        recovered.states.some(
          (stored) => !sameNativeProvenance(stored.provenance, provenance)
        )
      )
        blockedJournals.add(recovered.id)
    }
    const compatibleJournals = recoveredJournals.filter(
      ({ id }) => !blockedJournals.has(id)
    )
    const basis =
      lead ?? compatibleJournals.flatMap(({ states }) => states)[0] ?? null
    const recovered = mergeJournal(
      basis,
      compatibleJournals.flatMap(({ states }) =>
        states
          .filter(({ epoch }) => epoch === basis?.epoch)
          .map(({ server, pending }) => mergedUpdate([server, pending]))
      )
    )
    client = openPaperClient(recovered, { provenance })
    for (const { id, states } of compatibleJournals) {
      for (const stored of states) {
        if (stored.epoch === client.epoch) continue
        const result = client.adopt(stored)
        if (result.failed || !result.adopted) blockedJournals.add(id)
      }
    }
    ready = recovered !== null
    waitingOrphans = rest
    unsubscribeClient = client.subscribe((change) => {
      version += 1
      if (state === "saved") setStatus("saving")
      if (change === "local") rememberLocal()
      void save()
      if (change === "local") schedule()
      if (change === "reset") generation += 1
      emit()
    })
    void store.prune(localDocId, timers.now()).catch(() => {})
    if (!loaded.own && loaded.orphans.length > 0) {
      await save()
      if (!localFailed) {
        await store.remove(localDocId, loaded.orphans[0]!.tabId).catch(() => {})
      }
    }
    emit()
    await run()
  })().catch(() => setStatus("stuck"))

  return api
}

type Held = { sync: PaperSync; users: number }

const held = new Map<string, Held>()
const watchers = new Set<() => void>()

function acquire(
  docId: PaperId,
  queryClient: QueryClient,
  provenance?: NativeProvenance
) {
  const key = provenance ? `native:${docId}` : docId
  const known = held.get(key)
  if (known) {
    known.users += 1
    return
  }
  held.set(key, {
    sync: openPaperSync(docId, queryClient, { provenance }),
    users: 1,
  })
  for (const watcher of [...watchers]) watcher()
}

function release(docId: PaperId, provenance?: NativeProvenance) {
  const key = provenance ? `native:${docId}` : docId
  queueMicrotask(() => {
    const known = held.get(key)
    if (!known) return
    known.users -= 1
    if (known.users > 0) return
    known.sync.destroy()
    held.delete(key)
    for (const watcher of [...watchers]) watcher()
  })
}

export function usePaperSync(docId: PaperId, provenance?: NativeProvenance) {
  const key = provenance ? `native:${docId}` : docId
  const queryClient = useQueryClient()
  const sync = useSyncExternalStore(
    (listener) => {
      watchers.add(listener)
      acquire(docId, queryClient, provenance)
      return () => {
        watchers.delete(listener)
        release(docId, provenance)
      }
    },
    () => held.get(key)?.sync ?? null,
    () => null
  )
  const status = useSyncExternalStore(
    (listener) => sync?.subscribe(listener) ?? (() => {}),
    () => sync?.status() ?? "loading",
    () => "loading" as const
  )
  const generation = useSyncExternalStore(
    (listener) => sync?.subscribe(listener) ?? (() => {}),
    () =>
      sync
        ? sync.generation() * 4 +
          (sync.client() ? 1 : 0) +
          (sync.ready() ? 2 : 0)
        : 0,
    () => 0
  )
  return {
    sync,
    status,
    generation,
    client: sync?.ready() ? sync.client() : null,
  }
}
