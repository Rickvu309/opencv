import { useState } from "react"

import { ThreadTopBar } from "@/features/home/thread-top-bar.tsx"
import { authClient } from "@/lib/auth-client.ts"
import { ThreadView } from "@/features/home/thread-view.tsx"
import { CoachDock } from "@/features/coach/coach-dock.tsx"
import { ConnectedApps } from "@/features/home/connected-apps.tsx"
import { homeGreeting } from "@/features/home/greeting.ts"
import { HomeStart } from "@/features/home/home-start.tsx"
import { HomeSuggestions } from "@/features/home/home-suggestions.tsx"
import { useThreadStore } from "@/features/home/use-thread-store.ts"

export function HomeDashboard() {
  const { data } = authClient.useSession()
  const name = data?.user.name?.trim() || "there"
  const {
    messages,
    phase,
    error,
    send,
    stop,
    retry,
    regenerate,
    undo,
    newThread,
    deleteThread,
    activeThreadId,
    threads,
  } = useThreadStore()
  const activeTitle =
    threads.find((thread) => thread.id === activeThreadId)?.title ?? null
  const [draft, setDraft] = useState("")
  const turnActive = phase !== "idle"
  const started = messages.length > 0 || turnActive || activeThreadId != null

  function handleSend() {
    const text = draft.trim()
    if (!text) return
    if (send(text)) setDraft("")
  }

  if (started) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col">
        <ThreadTopBar
          onNewThread={newThread}
          threadTitle={activeTitle}
          onDeleteThread={
            activeThreadId
              ? () => {
                  void deleteThread(activeThreadId)
                }
              : undefined
          }
        />
        <div className="flex min-h-0 flex-1 flex-col">
          <ThreadView
            messages={messages}
            waiting={phase === "waiting"}
            error={error}
            onRetry={retry}
            onRegenerate={phase === "idle" ? regenerate : undefined}
            onUndo={phase === "idle" ? undo : undefined}
          />
        </div>
        <div className="shrink-0 bg-background px-4 pt-2 pb-4 sm:px-6">
          <div className="mx-auto w-full max-w-3xl">
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
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col justify-center px-4 py-5 sm:px-6">
          <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-5">
            <header className="w-full text-center">
              <h1 className="text-3xl font-normal tracking-tight sm:text-4xl">
                {homeGreeting(name)}
              </h1>
            </header>

            <div className="w-full space-y-3 overflow-visible">
              <CoachDock
                draft={draft}
                setDraft={setDraft}
                onSend={handleSend}
                menuPlacement="below"
              />
              <HomeSuggestions onSelect={setDraft} />
              <HomeStart />
              <ConnectedApps className="mt-1" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
