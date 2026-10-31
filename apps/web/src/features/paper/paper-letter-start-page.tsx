import { useEffect, useReducer, useRef } from "react"
import { ChevronRight, Mail } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { PaperLetterStart } from "./paper-letter-start.tsx"
import { PaperLetterDraftingPage } from "./paper-letter-drafting-page.tsx"
import "./design/letter-start.pen.css"

type DraftingState = {
  draftName: string
  attribution: string | null
  text: string
}

type DraftingAction =
  | {
      type: "drafting_started"
      draftName: string
      attribution: string | null
    }
  | { type: "drafting_text"; text: string }
  | { type: "drafting_ended" }

function draftingReducer(
  state: DraftingState | null,
  action: DraftingAction
): DraftingState | null {
  switch (action.type) {
    case "drafting_started":
      return {
        draftName: action.draftName,
        attribution: action.attribution,
        text: "",
      }
    case "drafting_text":
      return state !== null ? { ...state, text: action.text } : state
    case "drafting_ended":
      return null
  }
}

export function PaperLetterStartPage({
  onBack,
  onCreated,
}: {
  onBack: () => void
  onCreated: (id: string) => void
}) {
  const pageRef = useRef<HTMLElement>(null)
  const stopRef = useRef<(() => void) | null>(null)
  const [draftingState, dispatch] = useReducer(draftingReducer, null)

  const isDrafting = draftingState !== null

  useEffect(() => {
    if (isDrafting) return
    pageRef.current
      ?.querySelector<HTMLInputElement>(
        '[role="textbox"], input:not([type="file"])'
      )
      ?.focus()
  }, [isDrafting])

  return (
    <section
      ref={pageRef}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !event.nativeEvent.isComposing) {
          event.preventDefault()
          onBack()
        }
      }}
      data-pen-surface="paper"
      data-slot="letter-start-page"
      aria-label={draftingState ? "Drafting cover letter" : "New cover letter"}
      className="relative flex h-full min-h-0 flex-col"
    >
      {/* Form — always mounted; hidden during drafting so PaperLetterStart's
          async draft/refs survive the transition */}
      <div
        hidden={isDrafting}
        className={draftingState ? "hidden" : "flex min-h-0 flex-1 flex-col"}
      >
        <header
          data-slot="letter-start-header"
          className="flex h-12 shrink-0 items-center gap-2 border-b px-4 pl-5 text-[13.5px]"
        >
          <Button
            variant="ghost"
            onClick={onBack}
            className="h-auto p-0 text-[13.5px] font-normal"
          >
            Paper
          </Button>
          <ChevronRight aria-hidden="true" className="size-3.5" />
          <span className="min-w-0 truncate">Cover letters</span>
          <ChevronRight aria-hidden="true" className="size-3.5" />
          <Mail aria-hidden="true" className="-me-0.5 size-[15px] shrink-0" />
          <span aria-current="page" className="shrink-0">
            New cover letter
          </span>
        </header>
        <div
          data-slot="letter-start-desk"
          className="flex min-h-0 flex-1 items-center justify-center overflow-auto px-4 py-8 md:pt-0 md:pb-12"
        >
          <div className="w-full max-w-[600px]">
            <h1 className="mb-5 text-xl leading-6 font-semibold tracking-[-0.2px]">
              Start a cover letter
            </h1>
            <PaperLetterStart
              onCreated={onCreated}
              onDraftingStart={(draftName, attribution) => {
                dispatch({ type: "drafting_started", draftName, attribution })
              }}
              onDraftText={(text) => {
                dispatch({ type: "drafting_text", text })
              }}
              onDraftingEnd={() => {
                dispatch({ type: "drafting_ended" })
              }}
              stopRef={stopRef}
            />
          </div>
        </div>
      </div>

      {draftingState ? (
        <PaperLetterDraftingPage
          draftName={draftingState.draftName}
          attribution={draftingState.attribution}
          streamedText={draftingState.text}
          onStop={() => stopRef.current?.()}
          onBack={onBack}
        />
      ) : null}
    </section>
  )
}
