import { useState } from "react"

import { PLACEHOLDER_USER_NAME } from "@/features/app-shell/placeholder-user.ts"
import { Composer } from "@/features/home/composer.tsx"
import { ConnectedApps } from "@/features/home/connected-apps.tsx"
import { homeGreeting } from "@/features/home/greeting.ts"
import { HomeSuggestions } from "@/features/home/home-suggestions.tsx"

export function HomeDashboard() {
  const [draft, setDraft] = useState("")

  function handleSend() {
    // Sending / chat mode is QVE-93. Accept the draft so Enter is observable.
    if (!draft.trim()) return
    setDraft("")
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col justify-center px-4 py-5 sm:px-6">
          <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-5">
            <header className="w-full text-center">
              <h1 className="font-[ui-serif,Georgia,Cambria,serif] text-3xl font-normal tracking-tight sm:text-4xl">
                {homeGreeting(PLACEHOLDER_USER_NAME)}
              </h1>
            </header>

            <div className="w-full space-y-2 overflow-visible">
              <HomeSuggestions onSelect={setDraft} />
              <Composer
                draft={draft}
                setDraft={setDraft}
                onSend={handleSend}
                placeholder="How can I help you today?"
                menuPlacement="below"
              />
              <ConnectedApps className="mt-1" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
