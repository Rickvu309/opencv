import { useLayoutEffect, useReducer, useRef, type KeyboardEvent } from "react"
import { FileUp, Sparkles } from "lucide-react"

import type { PaperTemplateId } from "@workspace/domain/paper-doc"
import { Button } from "@workspace/ui/components/button"
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Spinner } from "@workspace/ui/components/spinner"

import { TEMPLATE_CHOICES } from "./paper-template-pages.ts"
import { TemplatePage } from "./paper-template-thumb.tsx"
import "./design/paper-template-gallery.css"

export const PAPER_GALLERY_DIALOG_CLASS =
  "paper-picker flex flex-col gap-0 overflow-hidden sm:max-w-3xl lg:max-w-[960px]"

export type PickerChoice = PaperTemplateId | "blank"

type PickerAction = { type: "selected"; choice: PickerChoice }

function pickerSelection(
  selected: PickerChoice | undefined,
  action: PickerAction
): PickerChoice | undefined {
  switch (action.type) {
    case "selected":
      return selected === action.choice ? selected : action.choice
  }
}

export function focusChosenTemplate() {
  return (
    document.querySelector<HTMLElement>(
      '[data-template-gallery] [data-template-card][aria-checked="true"]'
    ) ?? true
  )
}

function Specimen({ id }: { id: PickerChoice }) {
  return <TemplatePage templateId={id} className="paper-picker-page" />
}

function centerCard(track: HTMLDivElement | null, card: HTMLElement) {
  if (!track || track.scrollWidth <= track.clientWidth) return
  const trackBounds = track.getBoundingClientRect()
  const cardBounds = card.getBoundingClientRect()
  track.scrollTo({
    left:
      track.scrollLeft +
      cardBounds.left -
      trackBounds.left +
      (cardBounds.width - trackBounds.width) / 2,
    behavior: "instant",
  })
}

export function PaperTemplateGallery({
  title,
  description,
  onUse,
  onImport,
  onBlank,
  onCoach,
  pending = false,
  error = null,
  initial,
  kind = "cv",
}: {
  title: string
  description: string
  onUse: (templateId: PaperTemplateId) => void
  onImport?: () => void
  onBlank?: () => void
  onCoach?: () => void
  pending?: boolean
  error?: string | null
  initial?: PickerChoice
  kind?: "cv" | "letter"
}) {
  const templates = kind === "cv" ? TEMPLATE_CHOICES : []
  const [selected, dispatch] = useReducer(
    pickerSelection,
    initial ?? templates[0]?.id
  )
  const grid = useRef<HTMLDivElement>(null)
  const choices = [
    ...(onBlank
      ? [
          {
            id: "blank" as const,
            label: "Blank",
            use: "An empty page with no formatting.",
          },
        ]
      : []),
    ...templates,
  ]
  const index = Math.max(
    0,
    choices.findIndex(({ id }) => id === selected)
  )
  const chosen = choices[index]

  useLayoutEffect(() => {
    const card = grid.current?.querySelector<HTMLElement>(
      '[aria-checked="true"]'
    )
    if (card) centerCard(grid.current, card)
  }, [])

  function confirmChoice(id: PickerChoice | undefined) {
    if (pending || id === undefined) return
    if (id === "blank") onBlank?.()
    else onUse(id)
  }

  function moveFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (pending) return
    if (event.key === "Enter") {
      event.preventDefault()
      confirmChoice(chosen?.id)
      return
    }
    const cards = [
      ...event.currentTarget.querySelectorAll<HTMLElement>(
        "[data-template-card]"
      ),
    ]
    const firstTop = cards[0]?.offsetTop
    const columns = cards.filter((card) => card.offsetTop === firstTop).length
    const columnStep =
      event.currentTarget.scrollWidth > event.currentTarget.clientWidth
        ? 1
        : columns
    const offsets: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -columnStep,
      ArrowDown: columnStep,
    }
    const offset = offsets[event.key]
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? cards.length - 1
          : index + (offset ?? 0)
    if (event.key !== "Home" && event.key !== "End" && offset === undefined)
      return
    const nextIndex = Math.min(cards.length - 1, Math.max(0, next))
    const card = cards[nextIndex]
    const choice = choices[nextIndex]
    if (!card || !choice) return
    event.preventDefault()
    card.focus({ preventScroll: true })
    centerCard(grid.current, card)
    dispatch({ type: "selected", choice: choice.id })
  }

  function syncCarousel(track: HTMLDivElement) {
    if (pending || track.scrollWidth <= track.clientWidth) return
    const trackCenter =
      track.getBoundingClientRect().left + track.clientWidth / 2
    const cards = [
      ...track.querySelectorAll<HTMLElement>("[data-template-card]"),
    ]
    const nearest = cards.reduce((closest, card, candidate) => {
      const distance = (element: HTMLElement) => {
        const bounds = element.getBoundingClientRect()
        return Math.abs(bounds.left + bounds.width / 2 - trackCenter)
      }
      return distance(card) < distance(cards[closest]!) ? candidate : closest
    }, 0)
    const choice = choices[nearest]
    if (choice) dispatch({ type: "selected", choice: choice.id })
  }

  return (
    <div data-template-gallery="" className="paper-picker-content">
      <DialogHeader className="paper-picker-header pe-12">
        <DialogTitle className="text-xl font-semibold tracking-tight">
          {title}
        </DialogTitle>
        <DialogDescription className="text-sm">{description}</DialogDescription>
      </DialogHeader>
      <div className="paper-picker-body" data-slot="paper-picker-body">
        <div className="paper-picker-rail">
          <div data-template-scroll="" className="paper-picker-scroll min-h-0">
            <div
              ref={grid}
              role="radiogroup"
              aria-label="Templates"
              aria-busy={pending || undefined}
              data-template-grid=""
              className="paper-picker-grid"
              onKeyDown={moveFocus}
              onScrollEnd={(event) => syncCarousel(event.currentTarget)}
            >
              {choices.map(({ id, label, use }) => (
                <Button
                  key={id}
                  type="button"
                  variant="ghost"
                  role="radio"
                  aria-checked={id === chosen?.id}
                  aria-label={label}
                  aria-description={use}
                  aria-disabled={pending || undefined}
                  data-template-card={id}
                  tabIndex={id === chosen?.id ? 0 : -1}
                  className="paper-picker-choice h-11 whitespace-normal"
                  onClick={(event) => {
                    if (pending) return
                    centerCard(grid.current, event.currentTarget)
                    dispatch({ type: "selected", choice: id })
                  }}
                  onDoubleClick={() => confirmChoice(id)}
                >
                  <Specimen id={id} />
                  <span className="paper-picker-label">{label}</span>
                </Button>
              ))}
            </div>
          </div>
        </div>
        <div className="paper-picker-stage">
          {choices.map(({ id }) => (
            <div
              key={id}
              data-slot="paper-picker-preview"
              data-preview={id}
              data-visible={id === chosen?.id}
              className="paper-picker-preview"
              aria-hidden="true"
            >
              <Specimen id={id} />
            </div>
          ))}
        </div>
      </div>
      <footer
        data-slot="paper-gallery-actions"
        className="paper-picker-footer shrink-0"
      >
        {chosen ? (
          <div className="paper-picker-caption" aria-live="polite">
            <span className="font-semibold">{chosen.label}</span>
            {choices.length > 1 ? (
              <span className="paper-picker-counter text-muted-foreground tabular-nums">
                {index + 1} / {choices.length}
              </span>
            ) : null}
            <p className="text-xs text-muted-foreground">{chosen.use}</p>
          </div>
        ) : null}
        <div className="paper-picker-buttons">
          <Button
            type="button"
            variant="primary"
            className="h-auto min-h-11 py-2 text-sm whitespace-normal"
            disabled={!chosen || pending}
            onClick={() => confirmChoice(chosen?.id)}
          >
            {pending ? (
              <>
                <Spinner /> Creating…
              </>
            ) : chosen?.id === "blank" ? (
              "Start blank"
            ) : chosen ? (
              `Use ${chosen.label}`
            ) : (
              "Use template"
            )}
          </Button>
          {onCoach ? (
            <Button
              variant="ghost"
              className="h-11"
              onClick={onCoach}
              disabled={pending}
            >
              <Sparkles aria-hidden="true" /> Draft with Coach
            </Button>
          ) : null}
          {onImport ? (
            <Button
              variant="ghost"
              className="h-11"
              onClick={onImport}
              disabled={pending}
            >
              <FileUp aria-hidden="true" /> Import a file
            </Button>
          ) : null}
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </footer>
    </div>
  )
}
