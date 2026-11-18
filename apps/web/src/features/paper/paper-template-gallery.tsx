import { useLayoutEffect, useReducer, useRef, type KeyboardEvent } from "react"
import { FileUp, Sparkles } from "lucide-react"

import type { PaperTemplateId } from "@workspace/domain"
import { Button } from "@workspace/ui/components/button"
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"

import { findTemplates } from "./paper-template-pages.ts"
import {
  BlankPage,
  TEMPLATE_PAGE_CLASS,
  TemplatePage,
} from "./paper-template-thumb.tsx"
import "./design/paper-template-gallery.css"

export const PAPER_GALLERY_DIALOG_CLASS =
  "paper-picker flex flex-col gap-0 overflow-hidden sm:max-w-3xl lg:max-w-[960px]"

export type PickerChoice = PaperTemplateId | "blank"

type PickerSelection = { query: string; selected: PickerChoice | undefined }

type PickerAction =
  | { type: "searched"; query: string }
  | { type: "cleared" }
  | { type: "selected"; choice: PickerChoice }

function pickerSelection(
  state: PickerSelection,
  action: PickerAction
): PickerSelection {
  switch (action.type) {
    case "searched":
      return { query: action.query, selected: undefined }
    case "cleared":
      return { ...state, query: "" }
    case "selected":
      return state.selected === action.choice
        ? state
        : { ...state, selected: action.choice }
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
  return (
    <span className={`paper-picker-page ${TEMPLATE_PAGE_CLASS}`}>
      {id === "blank" ? (
        <BlankPage />
      ) : (
        <TemplatePage templateId={id} readable />
      )}
    </span>
  )
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
  const [{ query, selected }, dispatch] = useReducer(pickerSelection, {
    query: "",
    selected: initial,
  })
  const grid = useRef<HTMLDivElement>(null)
  const templates = kind === "cv" ? findTemplates(query) : []
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
  const preferred =
    choices.find(({ id }) => id === selected)?.id ??
    (query.trim() ? templates[0]?.id : undefined)
  const index = Math.max(
    0,
    choices.findIndex(({ id }) => id === preferred)
  )
  const chosen = choices[index]

  useLayoutEffect(() => {
    const card = grid.current?.querySelector<HTMLElement>(
      '[aria-checked="true"]'
    )
    if (card) centerCard(grid.current, card)
  }, [query])

  function useChoice(id: PickerChoice | undefined) {
    if (pending || id === undefined) return
    if (id === "blank") onBlank?.()
    else onUse(id)
  }

  function moveFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (pending) return
    if (event.key === "Enter") {
      event.preventDefault()
      useChoice(chosen?.id)
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
          {kind === "cv" ? (
            <Input
              type="search"
              aria-label="Search templates"
              placeholder="Search templates"
              autoComplete="off"
              enterKeyHint="go"
              value={query}
              className="paper-picker-search h-11 text-base md:text-sm"
              onChange={(event) =>
                dispatch({ type: "searched", query: event.target.value })
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  useChoice(chosen?.id)
                }
                if (event.key === "Escape" && query) {
                  event.preventDefault()
                  event.stopPropagation()
                  dispatch({ type: "cleared" })
                }
              }}
            />
          ) : null}
          {query.trim() &&
          templates.length === 0 &&
          query.trim().toLowerCase() !== "blank" ? (
            <div role="status" className="grid justify-items-start gap-2 p-4">
              <p>No template matches “{query.trim()}”.</p>
              <Button
                variant="outline"
                className="h-11"
                onClick={() => dispatch({ type: "cleared" })}
              >
                Clear search
              </Button>
            </div>
          ) : null}
          {query.trim() && templates.length > 0 ? (
            <p className="sr-only" role="status">
              {templates.length === 1
                ? "1 template"
                : `${templates.length} templates`}
            </p>
          ) : null}
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
                  className="paper-picker-choice h-auto whitespace-normal"
                  onClick={(event) => {
                    if (pending) return
                    centerCard(grid.current, event.currentTarget)
                    dispatch({ type: "selected", choice: id })
                  }}
                  onDoubleClick={() => useChoice(id)}
                >
                  <Specimen id={id} />
                  <span>{label}</span>
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
            onClick={() => useChoice(chosen?.id)}
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
