import "fake-indexeddb/auto"
import * as Y from "yjs"
import {
  canonicalPaper,
  nativeProvenance,
  RICH_NATIVE_WRITER,
} from "@workspace/domain/paper-doc"
import {
  emptyUpdate,
  openRichPaperClient,
  seedStoredYDoc,
} from "@workspace/paper-crdt"
import { afterEach, expect, it, vi } from "vitest"
import { storedFlowFixture } from "../../../../packages/paper-crdt/src/test/flow-fixture.ts"
import { deferred, sessionHarness } from "./paper-sync-native.fixtures.ts"
import { openRichNativePaperSync } from "./paper-native-transport.ts"
import {
  appendNativeJournal,
  scanNativeJournals,
} from "./paper-sync-recovery.ts"
import { requireNativeIdentity } from "./paper-sync-identity.ts"

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it.each(["cv", "letter"] as const)(
  "recovers %s input and waits for exact local completion after server acceptance",
  async (kind) => {
    const h = sessionHarness()
    const document = storedFlowFixture(kind)
    const provenance = nativeProvenance(document)
    const identity = requireNativeIdentity({
      ...h.options.identity,
      provenance,
      writer: RICH_NATIVE_WRITER,
    })
    const admitted = {
      epoch: 1,
      revision: 1,
      provenance,
      server: seedStoredYDoc(document),
      pending: emptyUpdate(),
    }
    const previous = openRichPaperClient(admitted, { provenance })
    const visit = (fragment: Y.XmlFragment): boolean => {
      for (const child of fragment.toArray()) {
        if (child instanceof Y.XmlText && child.length) {
          child.insert(child.length, " recovered Việt 😀")
          return true
        }
        if (child instanceof Y.XmlElement && visit(child)) return true
      }
      return false
    }
    expect(
      visit(
        previous.ydoc.getXmlFragment(
          kind === "cv" ? "private-native-cv-v4-r2" : "document-store"
        )
      )
    ).toBe(true)
    const expected = previous.document()
    appendNativeJournal(
      h.options.journal,
      identity,
      "lost-tab",
      previous.stored()
    )
    previous.destroy()
    let current = identity
    h.run.mockResolvedValue({ ...h.reply, provenance })
    const sync = openRichNativePaperSync({
      ...h.options,
      identity,
      currentIdentity: () => current,
      readAdmitted: async () => admitted,
    })
    const gate = deferred()
    try {
      await sync.initialized
      expect(sync.client()?.document()).toEqual(expected)
      expect(sync.status()).toBe("saved")
      const saved = sync.captureSaved()
      expect(saved?.canonical).toBe(canonicalPaper(expected))
      expect(saved?.current()).toBe(true)
      const save = h.store.save.bind(h.store)
      h.store.save = async (...args) => {
        await gate.promise
        await save(...args)
      }
      const live = sync.client()
      if (!live) throw new Error("Missing rich client")
      h.run.mockClear()
      expect(
        visit(
          live.ydoc.getXmlFragment(
            kind === "cv" ? "private-native-cv-v4-r2" : "document-store"
          )
        )
      ).toBe(true)
      const flushing = sync.flush()
      await vi.waitFor(() => expect(h.run).toHaveBeenCalled())
      await vi.waitFor(() => expect(live.hasPending()).toBe(false))
      expect(sync.status()).not.toBe("saved")
      expect(sync.captureSaved()).toBeNull()
      expect(saved?.current()).toBe(false)
      gate.release()
      await flushing
      expect(sync.status()).toBe("saved")
      expect(saved?.current()).toBe(false)
      const latest = sync.captureSaved()
      expect(latest?.current()).toBe(true)
      expect(
        scanNativeJournals(h.options.journal, identity).flatMap(
          (entry) => entry.states
        )
      ).toEqual([])
      current = requireNativeIdentity({
        ...identity,
        ownerId: "different-owner",
      })
      expect(sync.status()).toBe("refused")
      expect(latest?.current()).toBe(false)
      expect(sync.captureSaved()).toBeNull()
      expect(sync.client()).toBeNull()
    } finally {
      gate.release()
      await sync.destroy()
    }
  }
)
