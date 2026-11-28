import { QueryClient } from "@tanstack/react-query"
import {
  nativeProvenance,
  RICH_NATIVE_WRITER,
} from "@workspace/domain/paper-doc"
import { emptyUpdate, seedStoredYDoc, type Stored } from "@workspace/paper-crdt"
import { vi } from "vitest"
import { storedFlowFixture } from "../../../../packages/paper-crdt/src/test/flow-fixture.ts"
import { requireNativeIdentity } from "./paper-sync-identity.ts"
import type { NativeSyncTransport } from "./paper-native-transport.ts"
import * as stores from "./paper-sync-store.ts"
import { toBase64 } from "./paper-sync-bytes.ts"

export const document = storedFlowFixture("letter")
export const provenance = nativeProvenance(document)
export const identity = requireNativeIdentity({
  kind: "native",
  ownerId: "one",
  sessionId: "a",
  docId: "00000000-0000-4000-8000-000000000001",
  provenance,
  writer: RICH_NATIVE_WRITER,
})
export const stored: Stored = {
  epoch: 1,
  revision: 1,
  provenance,
  server: seedStoredYDoc(document),
  pending: emptyUpdate(),
}
export function memory(): Storage {
  const records = new Map<string, string>()
  return {
    get length() {
      return records.size
    },
    clear() {
      records.clear()
    },
    key: (index) => [...records.keys()][index] ?? null,
    getItem: (key) => records.get(key) ?? null,
    setItem(key, value) {
      records.set(key, value)
    },
    removeItem(key) {
      records.delete(key)
    },
  }
}
export function deferred() {
  let release = () => {}
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return { promise, release }
}
export function sessionHarness() {
  vi.spyOn(stores, "heldLocks").mockResolvedValue(new Set())
  vi.spyOn(stores, "holdNativeTabLock").mockResolvedValue(() => {})
  const store = stores.memoryStore()
  const reply = {
    provenance,
    epoch: 1,
    revision: 1,
    reset: false,
    stale: false,
    update: toBase64(emptyUpdate()),
    stateVector: "",
  }
  const run = vi.fn<NativeSyncTransport>().mockResolvedValue(reply)
  let current = identity
  const options = {
    identity,
    currentIdentity: () => current,
    readAdmitted: async () => stored,
    queryClient: new QueryClient(),
    journal: memory(),
    store,
    run,
    tabId: "active",
  }
  return {
    options,
    store,
    run,
    reply,
    changeOwner() {
      current = { ...identity, ownerId: "two" }
    },
    changeSession() {
      current = { ...identity, sessionId: "next-session" }
    },
  }
}
