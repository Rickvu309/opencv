import { useQueryClient } from "@tanstack/react-query"
import type { PaperId, PaperView } from "@workspace/domain"
import { useCallback, useEffect, useRef } from "react"

import { ApiError } from "@/lib/api-error.ts"
import { refreshQueries, useRunCommand } from "@/lib/contract-client.ts"

type Options<T> = {
  docId: PaperId
  initialVersion: number
  toDocument: (value: T) => unknown
  onSaved: (saved: PaperView, inputEpoch: number) => void
  onConflict: () => void
  onError: (error: unknown) => void
  readInputEpoch?: () => number
}

export function usePaperAutosave<T>({
  docId,
  initialVersion,
  toDocument,
  onSaved,
  onConflict,
  onError,
  readInputEpoch,
}: Options<T>) {
  const run = useRunCommand()
  const queryClient = useQueryClient()
  const versionRef = useRef(initialVersion)
  const pendingRef = useRef<T | null>(null)
  const timerRef = useRef<number | null>(null)
  const inflightRef = useRef(false)
  const epochRef = useRef(0)
  const appliedEpochRef = useRef(0)
  const conflictRef = useRef(false)
  const unloadRef = useRef(false)
  const onSavedRef = useRef(onSaved)
  const onConflictRef = useRef(onConflict)
  const onErrorRef = useRef(onError)
  const toDocumentRef = useRef(toDocument)
  const readInputEpochRef = useRef(readInputEpoch)
  useEffect(() => {
    onSavedRef.current = onSaved
    onConflictRef.current = onConflict
    onErrorRef.current = onError
    toDocumentRef.current = toDocument
    readInputEpochRef.current = readInputEpoch
  }, [onSaved, onConflict, onError, toDocument, readInputEpoch])

  const flush = useCallback(async () => {
    if (conflictRef.current || inflightRef.current) return
    inflightRef.current = true
    let saves = 0
    let resentOnUnload = false
    try {
      while (pendingRef.current != null && !conflictRef.current) {
        const sentEpoch = epochRef.current
        const next = pendingRef.current
        const inputEpoch = readInputEpochRef.current?.() ?? sentEpoch
        pendingRef.current = null
        try {
          const saved = await run(
            "paper.replace",
            {
              docId,
              contentVersion: versionRef.current,
              document: toDocumentRef.current(next),
            },
            {
              refresh: false,
              ...(unloadRef.current ? { keepalive: true } : {}),
            }
          )
          saves += 1
          if (sentEpoch < appliedEpochRef.current) continue
          appliedEpochRef.current = sentEpoch
          versionRef.current = saved.contentVersion
          if (sentEpoch === epochRef.current) {
            onSavedRef.current(saved, inputEpoch)
          }
        } catch (error) {
          if (error instanceof ApiError && error.code === "CONFLICT") {
            conflictRef.current = true
            pendingRef.current = null
            if (timerRef.current != null) {
              window.clearTimeout(timerRef.current)
              timerRef.current = null
            }
            onConflictRef.current()
            break
          }
          if (pendingRef.current == null && sentEpoch === epochRef.current) {
            pendingRef.current = next
          }
          if (
            unloadRef.current &&
            pendingRef.current != null &&
            !resentOnUnload
          ) {
            resentOnUnload = true
            continue
          }
          onErrorRef.current(error)
          break
        }
      }
    } finally {
      inflightRef.current = false
      if (saves > 0 && pendingRef.current == null) {
        void refreshQueries(queryClient, [
          { query: "paper.list" },
          { query: "paper.pageCount", input: { docId } },
        ])
      }
    }
  }, [docId, run, queryClient])

  const flushRef = useRef(flush)
  useEffect(() => {
    flushRef.current = flush
  }, [flush])
  useEffect(() => {
    const onPageHide = () => {
      unloadRef.current = true
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
      void flushRef.current()
    }
    const onPageShow = () => {
      unloadRef.current = false
    }
    window.addEventListener("pagehide", onPageHide)
    window.addEventListener("pageshow", onPageShow)
    return () => {
      window.removeEventListener("pagehide", onPageHide)
      window.removeEventListener("pageshow", onPageShow)
      if (document.visibilityState === "hidden") unloadRef.current = true
      if (timerRef.current != null) window.clearTimeout(timerRef.current)
      void flushRef.current()
    }
  }, [])

  function queue(next: T, delay: number) {
    if (conflictRef.current) return
    epochRef.current += 1
    pendingRef.current = next
    if (timerRef.current != null) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      void flush()
    }, delay)
  }

  function schedule(next: T) {
    queue(next, 700)
  }

  function commitNow(next: T) {
    if (conflictRef.current) return
    epochRef.current += 1
    pendingRef.current = next
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    void flush()
  }

  function adopt(version: number) {
    versionRef.current = version
    conflictRef.current = false
    pendingRef.current = null
    epochRef.current += 1
    appliedEpochRef.current = epochRef.current
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  return { schedule, commitNow, adopt, versionRef }
}
