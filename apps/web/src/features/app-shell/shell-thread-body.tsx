import { useState } from "react"

import { CoachDock } from "@/features/coach/coach-dock.tsx"
import { ThreadView } from "@/features/home/thread-view.tsx"
import { useThreadStore } from "@/features/home/use-thread-store.ts"

export function ShellThreadBody() {
  const { messages, phase, error, send, stop, retry, regenerate, rate, undo } =
    useThreadStore()
  const [draft, setDraft] = useState("")
  const turnActive = phase !== "idle"

  function handleSend() {
    const text = draft.trim()
    if (!text) return
    if (send(text)) setDraft("")
  }

  return (
    <div data-slot="coach-panel-body" className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-auto">
        <ThreadView
          messages={messages}
          waiting={phase === "waiting"}
          error={error}
          onRetry={retry}
          onRate={rate}
          onRegenerate={phase === "idle" ? regenerate : undefined}
          onUndo={phase === "idle" ? undo : undefined}
        />
      </div>
      <div className="shrink-0 px-3 pt-2 pb-3">
        <CoachDock
          draft={draft}
          setDraft={setDraft}
          onSend={handleSend}
          onStop={stop}
          turnActive={turnActive}
          menuPlacement="above"
        />
      </div>
    </div>
  )
}
