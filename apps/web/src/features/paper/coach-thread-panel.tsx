import { useQuery } from "@tanstack/react-query"
import { useCallback, useEffect, useRef, useState } from "react"

import { Button } from "@workspace/ui/components/button"

import { CoachDock } from "@/features/coach/coach-dock.tsx"
import { useCoachTurn } from "@/features/coach/use-coach-turn.ts"
import { ThreadView } from "@/features/home/thread-view.tsx"
import {
  getThreadByFocusDoc,
  threadQueryKeys,
} from "@/features/home/thread-api.ts"

import type { ToolbarVariant } from "./paper-editor-toolbar.tsx"

const QUICK_PROMPTS: Record<ToolbarVariant, string[]> = {
  cv: [
    "Sharpen my checkout project bullet",
    "Add a metric to outcome",
    "Tailor for associate PM intern",
    "What should I cut?",
  ],
  proof: [
    "Turn this note into an outcome",
    "What screenshot should I add?",
    "Link this to my CV",
  ],
  letter: [
    "Make opening stronger",
    "Tie in my checkout Proof",
    "Shorten to half page",
    "Fix tone — less stiff",
  ],
  full: ["Rewrite selection", "Fix spelling", "Make it shorter"],
}

type Props = {
  docId: string
  docName: string
  variant: ToolbarVariant
}

export function CoachThreadPanel({ docId, docName, variant }: Props) {
  const listRef = useRef<HTMLDivElement>(null)
  const [createdThreadId, setCreatedThreadId] = useState<string | null>(null)
  const [draft, setDraft] = useState("")

  const focusedThreadQuery = useQuery({
    queryKey: threadQueryKeys.byFocusDoc(docId),
    queryFn: () => getThreadByFocusDoc(docId),
    staleTime: Infinity,
  })

  const threadId = createdThreadId ?? focusedThreadQuery.data?.id ?? null
  const titleForCreate = useCallback(() => docName, [docName])
  const { messages, phase, error, send, stop, retry, regenerate, rate, undo } =
    useCoachTurn({
      threadId,
      setThreadId: setCreatedThreadId,
      titleForCreate,
      focusDocId: docId,
    })

  const turnActive = phase !== "idle"
  const showTranscript = messages.length > 0 || turnActive || Boolean(error)

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages, phase, error])

  function submit(text?: string) {
    const next = (text ?? draft).trim()
    if (!next || turnActive) return
    if (send(next)) setDraft("")
  }

  return (
    <div className="shrink-0 border-t border-border bg-background px-4 pt-2 pb-4 sm:px-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
        {showTranscript ? (
          <div
            ref={listRef}
            className="max-h-64 min-h-0 overflow-auto"
          >
            <ThreadView
              compact
              messages={messages}
              waiting={phase === "waiting"}
              error={error}
              onRetry={retry}
              onRate={rate}
              onRegenerate={phase === "idle" ? regenerate : undefined}
              onUndo={phase === "idle" ? undo : undefined}
            />
          </div>
        ) : (
          <div className="flex flex-wrap gap-1">
            {QUICK_PROMPTS[variant].map((chip) => (
              <Button
                key={chip}
                type="button"
                variant="outline"
                size="xs"
                onClick={() => submit(chip)}
                disabled={turnActive}
                className="h-auto rounded-full px-2 py-0.5 text-2xs text-muted-foreground"
              >
                {chip}
              </Button>
            ))}
          </div>
        )}
        <CoachDock
          draft={draft}
          setDraft={setDraft}
          onSend={() => submit()}
          onStop={stop}
          turnActive={turnActive}
          placeholder="Ask about this document…"
          menuPlacement="above"
          showModePicker={false}
        />
      </div>
    </div>
  )
}
