import {
  useEffect,
  useId,
  useReducer,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from "react"
import { Check, FileUp, Search } from "lucide-react"

import type { PaperTemplateId } from "@workspace/domain"

import { Button } from "@workspace/ui/components/button"
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"

import {
  findTemplates,
  MORE_TEMPLATE_COUNT,
  TEMPLATE_CHOICES,
  type TemplateChoice,
} from "./paper-template-pages.ts"
import {
  BlankPage,
  TEMPLATE_PAGE_CLASS,
  TemplatePage,
} from "./paper-template-thumb.tsx"

export const PAPER_GALLERY_DIALOG_CLASS =
  "flex flex-col sm:max-w-3xl lg:max-w-[960px] sm:h-[min(560px,calc(100dvh-clamp(16px,14dvh,120px)-16px))] max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:rounded-none overscroll-contain transition-[opacity,scale,translate]"

type Choice = PaperTemplateId | "blank"

type GalleryState = { query: string; selected: Choice | "top-match" }

type GalleryAction =
  | { type: "query_typed"; query: string }
  | { type: "query_cleared" }
  | { type: "choice_picked"; id: Choice }

function galleryReducer(
  state: GalleryState,
  action: GalleryAction
): GalleryState {
  switch (action.type) {
    case "query_typed":
      return { query: action.query, selected: "top-match" }
    case "query_cleared":
      return { ...state, query: "" }
    case "choice_picked":
      return { ...state, selected: action.id }
  }
}

function shownChoice(
  selected: Choice | "top-match",
  found: readonly TemplateChoice[],
  hasBlank: boolean
): Choice | null {
  if (selected === "blank" && hasBlank) return "blank"
  if (found.some((item) => item.id === selected)) return selected
  return found[0]?.id ?? (hasBlank ? "blank" : null)
}

function columnsOf(cards: HTMLElement[]) {
  const top = cards[0]?.getBoundingClientRect().top
  const sameRow = cards.filter(
    (card) => Math.abs(card.getBoundingClientRect().top - (top ?? 0)) < 2
  ).length
  return Math.max(1, sameRow)
}

const CHOSEN_CARD = '[data-template-grid] [data-template-card][tabindex="0"]'

export function focusChosenTemplate() {
  return document.querySelector<HTMLElement>(CHOSEN_CARD) ?? true
}

const STEP: Record<string, (columns: number) => number> = {
  ArrowRight: () => 1,
  ArrowLeft: () => -1,
  ArrowDown: (columns) => columns,
  ArrowUp: (columns) => -columns,
}

const CARD_CLASS =
  "group/card h-auto min-w-0 flex-col items-stretch justify-start gap-2 rounded-[10px] p-1.5 font-normal whitespace-normal text-start outline-none [-webkit-tap-highlight-color:transparent] focus-visible:ring-3 focus-visible:ring-ring/50 aria-disabled:cursor-wait aria-disabled:opacity-60 hover:bg-muted/60 aria-checked:bg-muted"

const PAGE_STATE_CLASS =
  "group-hover/card:shadow-[0_0_0_1px_var(--ring),0_1px_3px_oklch(0_0_0/0.08)] group-aria-checked/card:shadow-[0_0_0_2px_var(--primary),0_4px_12px_oklch(0_0_0/0.12)]"

function ChoiceCard({
  id,
  label,
  use,
  checked,
  disabled,
  onPick,
  onUse,
  children,
}: {
  id: Choice
  label: string
  use: string
  checked: boolean
  disabled: boolean
  onPick: () => void
  onUse: () => void
  children: ReactNode
}) {
  const describedBy = useId()
  const labelledBy = useId()
  return (
    <Button
      variant="ghost"
      type="button"
      role="radio"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-disabled={disabled || undefined}
      data-template-card={id}
      tabIndex={checked ? 0 : -1}
      className={`${CARD_CLASS} min-h-11`}
      onClick={() => {
        if (!disabled) onPick()
      }}
      onDoubleClick={() => {
        if (!disabled) onUse()
      }}
    >
      <span className={`${TEMPLATE_PAGE_CLASS} ${PAGE_STATE_CLASS}`}>
        {children}
        {checked ? (
          <span
            aria-hidden="true"
            className="absolute end-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground"
          >
            <Check className="size-3" strokeWidth={3} />
          </span>
        ) : null}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5 px-0.5">
        <span
          id={labelledBy}
          className="truncate text-[13px] leading-5 font-medium"
        >
          {label}
        </span>
        <span
          id={describedBy}
          className="truncate text-xs leading-4 text-muted-foreground"
        >
          {use}
        </span>
      </span>
    </Button>
  )
}

export function PaperTemplateGallery({
  title,
  description,
  onUse,
  onImport,
  onBlank,
  pending = false,
  error = null,
  initial = "simple",
}: {
  title: string
  description: string
  onUse: (templateId: PaperTemplateId) => void
  onImport?: () => void
  onBlank?: () => void
  pending?: boolean
  error?: string | null
  initial?: PaperTemplateId
}) {
  const hasBlank = Boolean(onBlank)
  const [{ query, selected }, dispatch] = useReducer(galleryReducer, {
    query: "",
    selected: hasBlank ? "blank" : initial,
  })
  const gridRef = useRef<HTMLDivElement>(null)
  const found = findTemplates(query)
  const chosen = shownChoice(selected, found, hasBlank)
  const chosenLabel =
    TEMPLATE_CHOICES.find((item) => item.id === chosen)?.label ?? null
  const searching = query.trim() !== ""

  useEffect(() => {
    gridRef.current?.ownerDocument
      .querySelector<HTMLElement>(CHOSEN_CARD)
      ?.focus()
  }, [])

  function use(choice: Choice | null) {
    if (pending || choice === null) return
    if (choice === "blank") onBlank?.()
    else onUse(choice)
  }

  function moveFocus(event: KeyboardEvent<HTMLDivElement>) {
    const cards = [
      ...(gridRef.current?.querySelectorAll<HTMLElement>(
        "[data-template-card]"
      ) ?? []),
    ]
    if (cards.length === 0) return
    if (event.key === "Enter") {
      event.preventDefault()
      use(chosen)
      return
    }
    const current = cards.findIndex(
      (card) => card === event.currentTarget.ownerDocument.activeElement
    )
    const step = STEP[event.key]
    let next: number | null = null
    if (step) next = current + step(columnsOf(cards))
    if (event.key === "Home") next = 0
    if (event.key === "End") next = cards.length - 1
    if (next === null) return
    event.preventDefault()
    const target = cards[Math.min(cards.length - 1, Math.max(0, next))]!
    target.focus()
    dispatch({
      type: "choice_picked",
      id: target.dataset.templateCard as Choice,
    })
  }

  const primaryLabel = pending
    ? "Creating…"
    : chosen === "blank"
      ? "Start blank"
      : chosenLabel
        ? `Use ${chosenLabel}`
        : "Use template"

  return (
    <div
      data-template-gallery=""
      className="flex min-h-0 flex-1 flex-col gap-4"
    >
      <div className="flex flex-col gap-3">
        <DialogHeader className="pe-10">
          <DialogTitle className="text-base">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <label className="relative block sm:max-w-80">
          <span className="sr-only">Search templates</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label="Search templates"
            placeholder="Search templates"
            autoComplete="off"
            enterKeyHint="go"
            value={query}
            className="h-11 ps-9 text-base md:h-8 md:text-sm [&::-webkit-search-cancel-button]:appearance-none"
            onChange={(event) =>
              dispatch({ type: "query_typed", query: event.target.value })
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                use(chosen)
              }
              if (event.key === "Escape" && query !== "") {
                event.preventDefault()
                event.stopPropagation()
                dispatch({ type: "query_cleared" })
              }
            }}
          />
        </label>
      </div>
      <div
        data-template-scroll=""
        className="-mx-6 min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pt-1 pb-4"
      >
        <div
          ref={gridRef}
          role="radiogroup"
          aria-label="Templates"
          aria-busy={pending || undefined}
          data-template-grid=""
          className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-4 sm:gap-x-4 sm:gap-y-5 lg:grid-cols-5"
          onKeyDown={moveFocus}
        >
          {hasBlank ? (
            <ChoiceCard
              id="blank"
              label="Blank"
              use="An empty page"
              checked={chosen === "blank"}
              disabled={pending}
              onPick={() => dispatch({ type: "choice_picked", id: "blank" })}
              onUse={() => use("blank")}
            >
              <BlankPage />
            </ChoiceCard>
          ) : null}
          {found.map((item) => (
            <ChoiceCard
              key={item.id}
              id={item.id}
              label={item.label}
              use={item.use}
              checked={chosen === item.id}
              disabled={pending}
              onPick={() => dispatch({ type: "choice_picked", id: item.id })}
              onUse={() => use(item.id)}
            >
              <TemplatePage templateId={item.id} />
            </ChoiceCard>
          ))}
        </div>
        <p
          data-template-note=""
          aria-live="polite"
          className="mt-4 text-xs text-muted-foreground"
        >
          {searching && found.length === 0 ? (
            <>
              No template matches “{query.trim()}”.{" "}
              <Button
                type="button"
                variant="link"
                className="h-11 px-0 text-xs font-medium text-foreground underline md:h-auto"
                onClick={() => dispatch({ type: "query_cleared" })}
              >
                Clear search
              </Button>
            </>
          ) : searching ? (
            `${found.length} ${found.length === 1 ? "template" : "templates"}`
          ) : (
            `${MORE_TEMPLATE_COUNT} more names, like Classic or Two column, share these pages. Search to find one.`
          )}
        </p>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div
        data-slot="paper-gallery-actions"
        className="-mx-6 -mb-6 flex shrink-0 items-center gap-3 border-t border-border bg-popover px-6 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] max-sm:rounded-none sm:rounded-b-[12px]"
      >
        {onImport ? (
          <Button
            className="h-11 gap-1.5 md:h-8"
            type="button"
            variant="outline"
            onClick={onImport}
          >
            <FileUp aria-hidden="true" />
            Import a file
          </Button>
        ) : null}
        <Button
          className="ms-auto h-11 min-w-28 gap-1.5 px-4 max-sm:flex-1 md:h-8"
          type="button"
          variant="primary"
          aria-busy={pending || undefined}
          onClick={() => use(chosen)}
          disabled={pending || chosen === null}
        >
          {pending ? <Spinner aria-hidden="true" /> : null}
          {primaryLabel}
        </Button>
      </div>
    </div>
  )
}
