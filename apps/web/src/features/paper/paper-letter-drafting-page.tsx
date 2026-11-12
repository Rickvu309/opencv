import { Fragment, useEffect, useRef } from "react"
import { Bell, Ellipsis, Link, Mail, Star } from "lucide-react"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb"
import { Button } from "@workspace/ui/components/button"
import "./design/letter-drafting.pen.css"

export function PaperLetterDraftingPage({
  draftName,
  attribution,
  streamedText,
  continuing = false,
  onStop,
  onBack,
}: {
  draftName: string
  attribution: string | null
  streamedText: string
  continuing?: boolean
  onStop: () => void
  onBack: () => void
}) {
  const stopButton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    stopButton.current?.focus()
  }, [])
  return (
    <section
      data-pen-surface="paper"
      data-slot="letter-drafting-page"
      aria-label="Drafting cover letter"
      className="relative flex min-h-0 flex-1 flex-col"
    >
      <header
        data-slot="letter-drafting-header"
        className="flex h-12 min-w-0 shrink-0 items-center gap-2 border-b px-4 ps-5 text-[13.5px] leading-4"
      >
        <Breadcrumb>
          <BreadcrumbList className="text-[13.5px] leading-4 text-inherit">
            <BreadcrumbItem>
              <Button
                variant="ghost"
                onClick={onBack}
                className="min-h-11 p-0 text-[13.5px] font-normal md:min-h-0"
              >
                Paper
              </Button>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="[&>svg]:size-3.5" />
            <BreadcrumbItem className="hidden sm:inline-flex">
              Cover letters
            </BreadcrumbItem>
            <BreadcrumbSeparator className="[&>svg]:size-3.5" />
            <BreadcrumbItem className="gap-2">
              <Mail aria-hidden="true" className="size-[15px] shrink-0" />
              <BreadcrumbPage className="font-normal max-md:min-w-0">
                {draftName}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <span
          aria-hidden="true"
          className="hidden shrink-0 items-center gap-2 md:flex"
        >
          <Star className="size-[15px]" />
          <Ellipsis className="size-4" />
        </span>
        <span
          data-slot="letter-drafting-status"
          aria-live="polite"
          className="ms-auto flex shrink-0 items-center gap-[7px] px-2 text-[13.5px]"
        >
          <Spinner aria-hidden="true" className="size-[15px] shrink-0" />
          {continuing ? (
            <span>Coach is still writing your letter</span>
          ) : (
            <span className="sr-only md:not-sr-only">Coach is writing…</span>
          )}
        </span>
        <span
          aria-hidden="true"
          data-slot="letter-drafting-header-actions"
          className="hidden shrink-0 items-center gap-[18px] px-[7px] md:flex"
        >
          <Link className="size-4" />
          <Bell className="size-4" />
        </span>
      </header>
      <div
        data-slot="letter-drafting-desk"
        className="flex min-h-0 flex-1 overflow-auto px-4 pt-6 pb-24"
      >
        <div
          data-slot="letter-drafting-card"
          className="mx-auto min-h-[792px] w-full max-w-[560px] shrink-0 rounded-[2px] px-6 py-8 md:px-[60px] md:py-14"
          aria-label="Letter content being drafted"
        >
          <div
            data-slot="letter-drafting-text"
            className="font-sans text-[11px] leading-[17.6px] break-words whitespace-pre-wrap"
          >
            {streamedText.split("\n").map((line, index) => (
              <Fragment key={index}>
                {index > 0 && "\n"}
                <span>{line}</span>
              </Fragment>
            ))}
            <span
              aria-hidden="true"
              data-slot="letter-drafting-cursor"
              className="inline-block h-[13px] w-[1.2px] motion-safe:animate-pulse"
            />
          </div>
          <div
            aria-hidden="true"
            data-slot="letter-drafting-placeholder"
            className="mt-3 flex flex-col gap-[10px]"
          >
            {[440, 400, 452, 300].map((width) => (
              <span
                key={width}
                className="h-[7px] max-w-full rounded-[3.5px]"
                style={{ width }}
              />
            ))}
          </div>
        </div>
      </div>
      <div
        data-slot="letter-drafting-bar"
        className="absolute bottom-8 left-1/2 flex h-11 max-w-[calc(100%-32px)] -translate-x-1/2 items-center gap-2 rounded-full border pr-[5px] pl-3 md:left-[calc(50%-21px)] md:h-9"
      >
        <Spinner aria-hidden="true" className="size-[15px] shrink-0" />
        <span
          data-slot="letter-drafting-label"
          className="shrink-0 text-[13px] leading-[15.5px] font-medium"
        >
          Drafting
        </span>
        {attribution !== null ? (
          <span
            data-slot="letter-drafting-attribution"
            className="min-w-0 truncate text-[12px] leading-[14.5px]"
          >
            {attribution}
          </span>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          ref={stopButton}
          data-slot="letter-drafting-stop"
          className="h-11 shrink-0 rounded-full px-[9px] text-[12px] leading-[14.5px] font-medium md:h-[26px]"
          onClick={onStop}
        >
          Stop
        </Button>
      </div>
    </section>
  )
}
