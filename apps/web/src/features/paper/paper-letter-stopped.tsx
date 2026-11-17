import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@workspace/ui/components/button"

import { messageOf } from "@/features/paper/paper-library-support.ts"
import { authClient } from "@/lib/auth-client.ts"
import { useRunCommand } from "@/lib/contract-client.ts"
import { isAbortError } from "@/lib/sse.ts"

import { redraftStoppedLetter } from "./paper-letter-continue.ts"
import {
  clearStoppedLetter,
  stoppedLetter,
  subscribeStoppedLetter,
} from "./paper-letter-resume.ts"

type NoticePhase = "idle" | "busy" | "failed"

export function LetterStoppedNotice({
  docId,
  pageText,
  onWritten,
}: {
  docId: string
  pageText: string | null
  onWritten?: (text: string) => void
}) {
  const record = useSyncExternalStore(
    subscribeStoppedLetter,
    stoppedLetter,
    () => null
  )
  const queryClient = useQueryClient()
  const run = useRunCommand()
  const session = authClient.useSession()
  const owner = session.data?.user.id ?? ""
  const email = session.data?.user.email
  const [phase, setPhase] = useState<NoticePhase>("idle")
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (pageText !== null && pageText.trim().length > 0)
      clearStoppedLetter(docId)
  }, [docId, pageText])

  useEffect(() => {
    const page = document.querySelector('article[aria-label="Page"]')
    if (!(page instanceof HTMLElement)) return
    const onInput = () => {
      if ((page.textContent ?? "").replaceAll("\u200b", "").trim().length > 0) {
        clearStoppedLetter(docId)
      }
    }
    page.addEventListener("input", onInput)
    return () => page.removeEventListener("input", onInput)
  }, [docId, pageText])

  if (pageText === null || pageText.trim().length > 0) return null
  if (!record || record.docId !== docId) return null

  async function go() {
    const current = stoppedLetter()
    if (!current || current.docId !== docId) return
    const controller = new AbortController()
    abortRef.current = controller
    setPhase("busy")
    setError(null)
    try {
      await redraftStoppedLetter({
        record: current,
        owner,
        email,
        queryClient,
        run,
        signal: controller.signal,
        onWritten,
      })
      if (!controller.signal.aborted) setPhase("idle")
    } catch (cause) {
      if (isAbortError(cause) || controller.signal.aborted) {
        setPhase("idle")
        return
      }
      setPhase("failed")
      setError(messageOf(cause, "Could not draft the letter. Try again."))
    }
  }

  function stop() {
    abortRef.current?.abort()
    setPhase("idle")
  }

  const writing = phase === "busy"
  return (
    <section
      data-slot="letter-stopped-notice"
      className="mx-auto flex w-[min(100%-3rem,816px)] flex-wrap items-center gap-x-3 gap-y-2 pt-4"
    >
      {phase === "failed" ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : (
        <p
          role="status"
          className={
            writing
              ? "text-sm text-foreground"
              : "text-sm text-muted-foreground/84"
          }
        >
          {writing ? "Coach is writing…" : "Coach stopped before writing."}
        </p>
      )}
      {writing ? (
        <Button
          type="button"
          variant="outline"
          className="h-11 md:h-8"
          onClick={stop}
        >
          Stop
        </Button>
      ) : (
        <Button type="button" className="h-11 md:h-8" onClick={() => void go()}>
          Continue drafting
        </Button>
      )}
    </section>
  )
}
