import {
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useSyncExternalStore,
} from "react"
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
  inset = false,
}: {
  docId: string
  pageText: string | null
  onWritten?: (text: string) => void
  inset?: boolean
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

  const latestText = useRef(pageText)
  useLayoutEffect(() => {
    latestText.current = pageText
  }, [pageText])

  if (
    notice.phase !== "failed" &&
    (pageText === null ||
      pageText.trim().length > 0 ||
      !record ||
      record.docId !== docId)
  )
    return null

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
        isBlank: () =>
          latestText.current !== null && latestText.current.trim().length === 0,
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
      className={
        inset
          ? "flex h-full w-full items-center justify-between gap-3"
          : "mx-auto flex h-24 w-[min(100%-3rem,816px)] shrink-0 items-center justify-between gap-3 md:h-16"
      }
    >
      {notice.phase === "failed" ? (
        <p role="alert" className="min-w-0 text-sm text-destructive">
          {notice.error}
        </p>
      ) : (
        <p
          role="status"
          className={
            writing
              ? "min-w-0 text-sm text-foreground"
              : "min-w-0 text-sm text-muted-foreground"
          }
        >
          {writing ? "Coach is writing…" : "Coach stopped before writing."}
        </p>
      )}
      {writing ? (
        <Button
          type="button"
          variant="outline"
          className="h-auto min-h-11 max-w-1/2 whitespace-normal md:min-h-8"
          onClick={stop}
        >
          Stop
        </Button>
      ) : record?.docId === docId ? (
        <Button
          type="button"
          className="h-auto min-h-11 max-w-1/2 whitespace-normal md:min-h-8"
          onClick={() => void go()}
        >
          Continue drafting
        </Button>
      ) : null}
    </section>
  )
}
