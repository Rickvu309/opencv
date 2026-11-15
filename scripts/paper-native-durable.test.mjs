import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import {
  detectNativeDurability,
  detectNativeStoreAdmission,
} from "./lib/paper-native-durable.mjs"
import { detectJournalErasure } from "./lib/paper-local-durable.mjs"

const clean = `const scope = nativeRecoveryScope(identity); const store = indexedDbStore(true)`
test("native bootstrap retains canonical CRDT identity", () => {
  assert.deepEqual(
    detectNativeDurability(`const server = fromBase64(reply.update)`),
    []
  )
  assert.ok(
    detectNativeDurability(`const server = seedYDoc(view.paper)`).length
  )
})
test("native shutdown retains local ownership until persistence settles", () => {
  const safe = `const destroy = () => { closing = persistence.then(() => { releaseLock() }) }`
  assert.deepEqual(detectNativeDurability(safe), [])
  assert.ok(
    detectNativeDurability(
      `const destroy = () => { releaseLock(); closing = persistence }`
    ).length
  )
})
test("native recovery rereads locked orphans and retains ownership for acknowledgement", () => {
  const safe = `const initialized = (async () => { const release = await holdNativeTabLock(scope, orphanTab); const current = await store.load(scope, orphanTab) })()`
  assert.deepEqual(detectNativeDurability(safe), [])
  assert.ok(
    detectNativeDurability(
      safe.replace("store.load(scope, orphanTab)", "store.load(scope, tabId)")
    ).length
  )
  assert.ok(
    detectNativeDurability(
      safe.replace(
        "const current =",
        "recoveryLocks.splice(0); const current ="
      )
    ).length
  )
})
test("native durability detector distinguishes isolated storage and stable scopes", () => {
  assert.deepEqual(detectNativeDurability(clean), [])
  const gate = `function status() { if (durableVersion === version && acceptedVersion === version && !client.hasPending()) return "saved" }`
  assert.deepEqual(detectNativeDurability(gate), [])
  assert.ok(
    detectNativeDurability(gate.replace("durableVersion === version", "true"))
      .length
  )
  assert.ok(
    detectNativeDurability(gate.replace("acceptedVersion === version", "true"))
      .length
  )
  assert.ok(detectNativeDurability(clean.replace("(true)", "()")).length)
  assert.ok(
    detectNativeDurability(
      clean.replace("nativeRecoveryScope", "nativeRuntimeScope")
    ).length
  )
  assert.ok(
    detectNativeDurability(
      "function scan() { try { read() } catch { return [] } }"
    ).length
  )
  assert.deepEqual(
    detectNativeDurability(
      readFileSync(
        new URL(
          "../apps/web/src/lib/paper-native-transport.ts",
          import.meta.url
        ),
        "utf8"
      )
    ),
    []
  )
})
test("native strict journal reader retains the historical erasure guard", () => {
  const good = `function read(raw) { return schema.parse(JSON.parse(raw)) }`
  assert.deepEqual(detectJournalErasure(good), [])
  assert.ok(
    detectJournalErasure(
      `function parse(raw) { try { return schema.parse(raw) } catch { return empty() } }`
    ).length
  )
  assert.deepEqual(
    detectJournalErasure(
      readFileSync(
        new URL("../apps/web/src/lib/paper-sync-recovery.ts", import.meta.url),
        "utf8"
      )
    ),
    []
  )
})
test("native loading refuses unreadable lock scans while keeping the legacy fallback", () => {
  const clean = `function indexedDbStore(native = false) { return { async load() { const held = await heldLocks(); if (native && !held) throw new Error("unreadable"); return held ? live : legacyAge } } }`
  assert.deepEqual(detectNativeStoreAdmission(clean), [])
  assert.ok(
    detectNativeStoreAdmission(
      clean.replace('throw new Error("unreadable")', "return empty")
    ).length
  )
  assert.deepEqual(
    detectNativeStoreAdmission(
      readFileSync(
        new URL("../apps/web/src/lib/paper-sync-store.ts", import.meta.url),
        "utf8"
      )
    ),
    []
  )
})
