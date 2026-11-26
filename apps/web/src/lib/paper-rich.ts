import type { QueryClient } from "@tanstack/react-query"
import {
  nativeSyncOutputSchema,
  sameNativeProvenance,
} from "@workspace/domain/paper-doc"
import { emptyUpdate } from "@workspace/paper-crdt"
import { catalogClient } from "./contract-client.ts"
import { openRichNativePaperSync } from "./paper-native-transport.ts"
import type { NativeSyncIdentity } from "./paper-sync-identity.ts"
import {
  downloadSavedRichWord,
  SavedRichWordChanged,
} from "./paper-rich-word.ts"
import { fromBase64 } from "./paper-sync-bytes.ts"

export const RICH_PULL_MS = 2500

export function openRichPaperSession(options: {
  readonly identity: NativeSyncIdentity
  readonly currentIdentity: () => unknown
  readonly queryClient: QueryClient
  readonly journal: Storage
}) {
  const cancellation = new AbortController()
  const session = openRichNativePaperSync({
    ...options,
    readAdmitted: async (identity) => {
      const reply = nativeSyncOutputSchema.parse(
        await catalogClient.run(
          options.queryClient,
          "paper.save",
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
      cancellation.signal.throwIfAborted()
      if (
        reply.stale ||
        !sameNativeProvenance(reply.provenance, identity.provenance)
      )
        throw new Error("Rich Paper bootstrap refused")
      return {
        epoch: reply.epoch,
        revision: reply.revision,
        provenance: reply.provenance,
        server: fromBase64(reply.update),
        pending: emptyUpdate(),
      }
    },
  })
  let downloading: Promise<void> | undefined
  let active = true
  let timer: ReturnType<typeof setTimeout> | undefined
  let detach = () => {}
  const flush = () => {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
    if (active) void session.flush()
  }
  const schedule = () => {
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(flush, 400)
  }
  void session.initialized.then(() => {
    if (!active) return
    detach =
      session.client()?.subscribe((change) => {
        if (change === "local") schedule()
      }) ?? (() => {})
    if (session.client()?.hasPending()) schedule()
  })
  const visibility = () => {
    if (document.visibilityState === "hidden") flush()
  }
  const pull = setInterval(() => {
    if (document.visibilityState === "visible" && timer === undefined) flush()
  }, RICH_PULL_MS)
  window.addEventListener("pagehide", flush)
  window.addEventListener("online", flush)
  window.addEventListener("focus", flush)
  document.addEventListener("visibilitychange", visibility)
  return {
    ...session,
    downloadWord() {
      if (downloading) return downloading
      const saved = session.captureSaved()
      if (!saved)
        return Promise.reject(
          session.ready()
            ? new SavedRichWordChanged()
            : new Error("Paper could not prepare the Word file.")
        )
      downloading = downloadSavedRichWord(saved, cancellation.signal).finally(
        () => {
          downloading = undefined
        }
      )
      return downloading
    },
    destroy() {
      if (!active) return session.destroy()
      active = false
      cancellation.abort()
      if (timer !== undefined) clearTimeout(timer)
      clearInterval(pull)
      detach()
      window.removeEventListener("pagehide", flush)
      window.removeEventListener("online", flush)
      window.removeEventListener("focus", flush)
      document.removeEventListener("visibilitychange", visibility)
      return session.destroy()
    },
  }
}
