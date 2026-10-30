import { useEffect, useRef } from "react"
import { ChevronRight, Mail } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { PaperLetterStart } from "./paper-letter-start.tsx"
import "./design/letter-start.pen.css"

export function PaperLetterStartPage({
  onBack,
  onCreated,
}: {
  onBack: () => void
  onCreated: (id: string) => void
}) {
  const pageRef = useRef<HTMLElement>(null)
  useEffect(() => {
    pageRef.current
      ?.querySelector<HTMLInputElement>(
        '[role="textbox"], input:not([type="file"])'
      )
      ?.focus()
  }, [])
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
      aria-label="New cover letter"
      className="flex h-full min-h-0 flex-col"
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
          <PaperLetterStart onCreated={onCreated} />
        </div>
      </div>
    </section>
  )
}
