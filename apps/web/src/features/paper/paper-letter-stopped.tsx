import {
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useSyncExternalStore,
} from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { messageOf } from "@/features/paper/paper-library-support.ts"
import { authClient } from "@/lib/auth-client.ts"
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
  | { type: "busy" }
  | { type: "idle" }
  | { type: "edited" }
  | { type: "failed"; error: string }

function noticeReducer(state: NoticeState, action: NoticeAction): NoticeState {
  switch (action.type) {
    case "edited":
      return state.phase === "failed" ? { phase: "idle", error: null } : state
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
  onWritten: (text: string) => void | Promise<void>
}) {
  const record = useSyncExternalStore(
    subscribeStoppedLetter,
    stoppedLetter,
    () => null
  )
  const queryClient = useQueryClient()
  const session = authClient.useSession()
  const owner = session.data?.user.id ?? ""
  const email = session.data?.user.email
  const [notice, dispatchNotice] = useReducer(noticeReducer, {
    phase: "idle",
    error: null,
  })
  const abortRef = useRef<AbortController | null>(null)
  const [reservedDocId, reserveRow] = useReducer(
    (_: string | null, id: string) => id,
    null
  )
  const visible =
    notice.phase !== "idle" ||
    (pageText !== null &&
      pageText.trim().length === 0 &&
      record?.docId === docId)

  useEffect(() => {
    if (visible) reserveRow(docId)
  }, [docId, visible])

  useEffect(() => {
    if (pageText !== null && pageText.trim().length > 0)
      clearStoppedLetter(docId)
  }, [docId, pageText])

  const latestText = useRef(pageText)
  useLayoutEffect(() => {
    latestText.current = pageText
  }, [pageText])

  useEffect(() => {
    dispatchNotice({ type: "edited" })
  }, [docId, pageText])

  useEffect(() => () => abortRef.current?.abort(), [docId])

  if (!visible && reservedDocId !== docId) return null

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
      aria-hidden={!visible || undefined}
      className={cn(
        "flex min-h-24 w-full shrink-0 flex-wrap items-center justify-between gap-3 py-3 md:min-h-16",
        !visible && "invisible"
      )}
    >
      {notice.phase === "failed" ? (
        <p
          role="alert"
          className="min-w-0 flex-1 basis-40 text-sm wrap-anywhere text-destructive"
        >
          {notice.error}
        </p>
      ) : (
        <p
          role="status"
          className={
            writing
              ? "min-w-0 flex-1 basis-40 text-sm wrap-anywhere text-foreground"
              : "min-w-0 flex-1 basis-40 text-sm wrap-anywhere text-muted-foreground"
          }
        >
          {writing ? "Coach is writing…" : "Coach stopped before writing."}
        </p>
      )}
      {writing ? (
        <Button
          type="button"
          variant="outline"
          className="ms-auto h-auto min-h-11 max-w-full whitespace-normal md:min-h-8"
          onClick={stop}
        >
          Stop
        </Button>
      ) : record?.docId === docId || (!visible && reservedDocId === docId) ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ms-auto h-auto min-h-11 max-w-full whitespace-normal md:min-h-8"
          onClick={() => void go()}
        >
          Continue drafting
        </Button>
      ) : null}
    </section>
  )
}
