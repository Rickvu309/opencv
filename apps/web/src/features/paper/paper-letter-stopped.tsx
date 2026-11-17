import { useEffect, useReducer, useRef, useSyncExternalStore } from "react"
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

type NoticeState = {
  phase: "idle" | "busy" | "failed"
  error: string | null
}

type NoticeAction =
  { type: "busy" } | { type: "idle" } | { type: "failed"; error: string }

function noticeReducer(_state: NoticeState, action: NoticeAction): NoticeState {
  switch (action.type) {
    case "busy":
      return { phase: "busy", error: null }
    case "idle":
      return { phase: "idle", error: null }
    case "failed":
      return { phase: "failed", error: action.error }
  }
}

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
  const [notice, dispatchNotice] = useReducer(noticeReducer, {
    phase: "idle",
    error: null,
  })
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
    dispatchNotice({ type: "busy" })
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
      if (!controller.signal.aborted) dispatchNotice({ type: "idle" })
    } catch (cause) {
      if (isAbortError(cause) || controller.signal.aborted) {
        dispatchNotice({ type: "idle" })
        return
      }
      dispatchNotice({
        type: "failed",
        error: messageOf(cause, "Could not draft the letter. Try again."),
      })
    }
  }

  function stop() {
    abortRef.current?.abort()
    dispatchNotice({ type: "idle" })
  }

  const writing = notice.phase === "busy"
  return (
    <section
      data-slot="letter-stopped-notice"
      className="mx-auto flex w-[min(100%-3rem,816px)] flex-wrap items-center gap-x-3 gap-y-2 pt-4"
    >
      {notice.phase === "failed" ? (
        <p role="alert" className="text-sm text-destructive">
          {notice.error}
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
