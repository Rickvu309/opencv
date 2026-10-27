import { useQueryClient } from "@tanstack/react-query"
import type { PaperId, PaperView } from "@workspace/domain"
import { useCallback, useEffect, useRef } from "react"

import { ApiError } from "@/lib/api-error.ts"
import { refreshQueries, useRunCommand } from "@/lib/contract-client.ts"

type Options<T> = {
  docId: PaperId
  initialVersion: number
  toDocument: (value: T) => unknown
  onSaved: (saved: PaperView) => void
  onConflict: () => void
  onError: (error: unknown) => void
}

/**
 * Saves run with `refresh: false` so a keystroke never refetches the document
 * over what the person is typing. The list and page count refresh once, when
 * the queue drains. One save at a time. A completion older than the latest scheduled edit
 * updates the version and does not count as the current document. A conflict
 * drops the pending edit and refuses further schedules until adopt().
 */
export function usePaperAutosave<T>({
  docId,
  initialVersion,
  toDocument,
  onSaved,
  onConflict,
  onError,
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
  const onSavedRef = useRef(onSaved)
  const onConflictRef = useRef(onConflict)
  const onErrorRef = useRef(onError)
  const toDocumentRef = useRef(toDocument)
  useEffect(() => {
    onSavedRef.current = onSaved
    onConflictRef.current = onConflict
    onErrorRef.current = onError
    toDocumentRef.current = toDocument
  }, [onSaved, onConflict, onError, toDocument])

  const flush = useCallback(async () => {
    if (conflictRef.current || inflightRef.current) return
    inflightRef.current = true
    let saves = 0
    try {
      while (pendingRef.current != null && !conflictRef.current) {
        const sentEpoch = epochRef.current
        const next = pendingRef.current
        pendingRef.current = null
        try {
          const saved = await run(
            "paper.replace",
            {
              docId,
              contentVersion: versionRef.current,
              document: toDocumentRef.current(next),
            },
            { refresh: false }
          )
          saves += 1
          if (sentEpoch < appliedEpochRef.current) continue
          appliedEpochRef.current = sentEpoch
          versionRef.current = saved.contentVersion
          if (sentEpoch === epochRef.current) onSavedRef.current(saved)
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
    return () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current)
      void flushRef.current()
    }
  }, [])

  function schedule(next: T) {
    if (conflictRef.current) return
    epochRef.current += 1
    pendingRef.current = next
    if (timerRef.current != null) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      void flush()
    }, 700)
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

  return { schedule, adopt, versionRef }
}
