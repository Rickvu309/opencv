import { ChevronRight } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import "./design/letter-drafting.pen.css"

export function PaperLetterDraftingPage({
  draftName,
  attribution,
  streamedText,
  onStop,
  onBack,
}: {
  draftName: string
  attribution: string | null
  streamedText: string
  onStop: () => void
  onBack: () => void
}) {
  return (
    <section
      data-pen-surface="paper"
      data-slot="letter-drafting-page"
      aria-label="Drafting cover letter"
      className="relative flex min-h-0 flex-1 flex-col"
    >
      <header
        data-slot="letter-drafting-header"
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
        <span>Cover letters</span>
        <ChevronRight aria-hidden="true" className="size-3.5" />
        <span aria-current="page" className="min-w-0 truncate">
          {draftName}
        </span>
        <span
          data-slot="letter-drafting-status"
          aria-live="polite"
          className="ml-auto shrink-0 text-[13.5px]"
        >
          Coach is writing…
        </span>
      </header>
      <div
        data-slot="letter-drafting-desk"
        className="flex min-h-0 flex-1 overflow-auto px-6 py-8"
      >
        <div
          data-slot="letter-drafting-card"
          className="mx-auto min-h-[400px] w-full max-w-[560px] rounded-xl px-8 py-10 shadow-sm"
          aria-live="polite"
          aria-label="Letter content being drafted"
        >
          {streamedText ? (
            <pre
              data-slot="letter-drafting-text"
              className="font-sans text-[11px] leading-[17.5px] break-words whitespace-pre-wrap"
            >
              {streamedText}
            </pre>
          ) : null}
          <span
            aria-hidden="true"
            data-slot="letter-drafting-cursor"
            className="inline-block h-[14px] w-px motion-safe:animate-pulse"
          />
        </div>
      </div>
      <div
        data-slot="letter-drafting-bar"
        className="absolute bottom-8 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-[10px] px-4 py-[9px] shadow-md"
      >
        <span
          data-slot="letter-drafting-label"
          className="text-[13px] leading-[15.5px] font-medium"
        >
          Drafting
        </span>
        {attribution !== null ? (
          <span
            data-slot="letter-drafting-attribution"
            className="text-[12px] leading-[14.5px]"
          >
            {attribution}
          </span>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          data-slot="letter-drafting-stop"
          className="h-auto p-0 text-[12px] leading-[14.5px] font-medium"
          onClick={onStop}
        >
          Stop
        </Button>
      </div>
    </section>
  )
}
