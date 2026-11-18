import "./design/coach.pen.css"
import "./design/composer-menus.pen.css"

import { useId, useReducer, type ReactNode } from "react"
import { useNavigate } from "@tanstack/react-router"
import {
  ArrowUp,
  ChevronDown,
  Leaf,
  Zap,
  Rocket,
  Check,
  ChevronRight,
  FileText,
  Kanban,
  Link,
  Mail,
  Paperclip,
  Plus,
  Square,
  X,
} from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@workspace/ui/components/dropdown-menu"
import { InputGroupButton } from "@workspace/ui/components/input-group"
import { cn } from "@workspace/ui/lib/utils"

import { PromptInput } from "@/components/ai-elements/prompt-input.tsx"
import { signatureIconButton } from "@/components/signature-button.ts"
import { SURFACE_PATHS } from "@/lib/product-paths.ts"
import {
  COACH_MODE_LOCKED,
  COACH_MODE_OPTIONS,
  coachModeAvailable,
} from "@/features/coach/coach-mode.ts"
import { useCoachMode } from "@/features/coach/use-coach-mode.ts"

const DOCK_MENU = [
  { id: "upload", label: "Upload a file", icon: Paperclip, caret: false },
  { id: "attach", label: "Add from Paper", icon: FileText, caret: true },
  { id: "job", label: "Add a job from Apply", icon: Kanban, caret: true },
  { id: "link", label: "Paste a job link", icon: Link, caret: false },
] as const

type MenuId = Exclude<(typeof DOCK_MENU)[number]["id"], "upload">

export const COACH_NO_UPLOAD_ROUTE = "Coach cannot read uploaded files yet."

export const COACH_CONTEXT_FULL =
  "This Chat has 8 items. Remove one to add another."

export type DockRecent = {
  id: string
  label: string
  kind: "cv" | "letter"
  attached: boolean
}

export type DockRecentList = {
  state: "loading" | "error" | "ready"
  items: readonly DockRecent[]
}

const SEND_FACE =
  "flex size-8 shrink-0 items-center justify-center rounded-full"

const MODE_ICONS = { free: Leaf, light: Zap, max: Rocket }

type MenuAction = { type: "opened" } | { type: "closed" }

function menuReducer(_open: boolean, action: MenuAction) {
  return action.type === "opened"
}

type Props = {
  draft: string
  setDraft: (value: string) => void
  onSend: () => void
  onStop?: () => void
  turnActive?: boolean
  placeholder?: string
  menuPlacement?: "below" | "above"
  showModePicker?: boolean
  onAttachFromPaper: () => void
  onAttachJob?: () => void
  onAttachLink?: () => void
  recent?: DockRecentList
  onRecentSelect?: (id: string) => void
  onAddMenuOpenChange?: (open: boolean) => void
  contextFull?: boolean
  disabled?: boolean
  holdReason?: string
  notice?: ReactNode
  primaryAction?: boolean
}

function repeatedClickOfSend(event: { detail: number }) {
  return event.detail > 1
}

export function CoachDock({
  draft,
  setDraft,
  onSend,
  onStop,
  turnActive = false,
  placeholder = "Ask the Coach",
  menuPlacement = "below",
  showModePicker = true,
  onAttachFromPaper,
  onAttachJob,
  onAttachLink,
  recent,
  onRecentSelect,
  onAddMenuOpenChange,
  contextFull = false,
  disabled = false,
  holdReason,
  notice,
  primaryAction = false,
}: Props) {
  const navigate = useNavigate()
  const sendHoldId = useId()
  const [menuOpen, menuDispatch] = useReducer(menuReducer, false)
  const [modeMenuOpen, modeMenuDispatch] = useReducer(menuReducer, false)
  const { mode, setMode, plan } = useCoachMode()
  const held = Boolean(holdReason)
  const showHold = held && draft.trim().length > 0
  const canSend = draft.trim().length > 0 && !disabled && !held

  function handleMenuAction(id: MenuId) {
    menuDispatch({ type: "closed" })
    if (id === "job") {
      if (onAttachJob) onAttachJob()
      else void navigate({ to: SURFACE_PATHS.apply })
    }
    if (id === "link") onAttachLink?.()
    if (id === "attach") onAttachFromPaper()
  }

  const tools = (
    <DropdownMenu
      open={menuOpen}
      onOpenChange={(open) => {
        menuDispatch({ type: open ? "opened" : "closed" })
        onAddMenuOpenChange?.(open)
      }}
    >
      <DropdownMenuTrigger
        render={
          <InputGroupButton
            size="icon-sm"
            className="-m-1.5 size-11 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground md:m-0 md:size-8"
          />
        }
        disabled={disabled}
        aria-label={menuOpen ? "Close menu" : "Add"}
        data-primary-action={primaryAction ? "" : undefined}
      >
        {menuOpen ? <X /> : <Plus />}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={menuPlacement === "above" ? "top" : "bottom"}
        align="start"
        sideOffset={8}
        className="flex flex-col"
        aria-label="Add to Coach"
        data-pen-surface="coach"
        data-slot="coach-add-menu"
      >
        {DOCK_MENU.filter((item) => item.id !== "link" || onAttachLink).map(
          (item) => {
            const Icon = item.icon
            const unavailable = item.id === "upload" || contextFull
            const reason =
              item.id === "upload" ? COACH_NO_UPLOAD_ROUTE : COACH_CONTEXT_FULL
            return (
              <DropdownMenuItem
                key={item.id}
                data-add-row=""
                data-add-note-row={item.id === "upload" ? "" : undefined}
                disabled={unavailable}
                onClick={
                  item.id === "upload"
                    ? undefined
                    : () => handleMenuAction(item.id)
                }
              >
                <Icon />
                {item.id === "upload" ? (
                  <span data-add-text="">
                    <span data-add-label="">{item.label}</span>
                    <span data-add-note="">{reason}</span>
                  </span>
                ) : (
                  <span data-add-label="">{item.label}</span>
                )}
                {unavailable && item.id !== "upload" ? (
                  <span className="sr-only">{reason}</span>
                ) : null}
                {item.caret ? <ChevronRight data-add-caret="" /> : null}
              </DropdownMenuItem>
            )
          }
        )}
        {contextFull ? (
          <p data-add-status="" data-add-full="" role="status">
            {COACH_CONTEXT_FULL}
          </p>
        ) : null}
        {recent ? (
          <>
            <div data-add-divider="">
              <div />
            </div>
            <div data-add-recent-label="" role="presentation">
              Recent
            </div>
            {recent.state === "ready" && recent.items.length === 0 ? (
              <p data-add-status="">Nothing in Paper yet.</p>
            ) : null}
            {recent.state === "loading" ? (
              <p data-add-status="" role="status">
                Loading…
              </p>
            ) : null}
            {recent.state === "error" ? (
              <p data-add-status="" role="alert">
                Could not load Paper.
              </p>
            ) : null}
            {recent.state === "ready"
              ? recent.items.map((item) => {
                  const Icon = item.kind === "letter" ? Mail : FileText
                  return (
                    <DropdownMenuItem
                      key={item.id}
                      data-add-row=""
                      disabled={contextFull && !item.attached}
                      aria-label={
                        item.attached ? `${item.label}, attached` : item.label
                      }
                      onClick={() => {
                        menuDispatch({ type: "closed" })
                        onRecentSelect?.(item.id)
                      }}
                    >
                      <Icon />
                      <span data-add-label="" title={item.label}>
                        {item.label}
                      </span>
                      {item.attached ? <Check data-add-check="" /> : null}
                    </DropdownMenuItem>
                  )
                })
              : null}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const ModeIcon = MODE_ICONS[mode]
  const modePicker = showModePicker ? (
    <DropdownMenu
      open={modeMenuOpen}
      onOpenChange={(open) =>
        modeMenuDispatch({ type: open ? "opened" : "closed" })
      }
    >
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            data-slot="coach-mode"
            className="-my-1.5 h-11 gap-1.25 rounded-full px-2 text-muted-foreground disabled:font-semibold disabled:text-muted-foreground/70 md:my-0 md:h-7.5"
          />
        }
        aria-label="Choose Coach mode"
      >
        <ModeIcon className="size-3.5" />
        {COACH_MODE_OPTIONS.find((option) => option.id === mode)?.label}
        <ChevronDown className="size-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={menuPlacement === "above" ? "top" : "bottom"}
        align="end"
        className="w-[268px] rounded-2xl p-2"
        aria-label="Coach mode"
        data-pen-surface="coach"
        data-slot="coach-mode-menu"
      >
        <DropdownMenuRadioGroup
          className="flex flex-col gap-0.5"
          value={mode}
          onValueChange={(next) => {
            if (next !== "free" && next !== "light" && next !== "max") return
            if (!coachModeAvailable(next, plan)) return
            setMode(next)
          }}
        >
          {COACH_MODE_OPTIONS.map((option) => {
            const Icon = MODE_ICONS[option.id]
            const available = coachModeAvailable(option.id, plan)
            const noteId = `coach-mode-${option.id}-note`
            return (
              <DropdownMenuRadioItem
                key={option.id}
                value={option.id}
                closeOnClick
                disabled={!available}
                data-slot="coach-mode-option"
                data-available={available ? "" : undefined}
                className="h-auto min-h-11 items-start gap-3.5 rounded-lg px-3 py-2 data-checked:pe-8 data-disabled:opacity-100"
                aria-label={
                  option.id === "free" ? option.label : `${option.label} · Pro`
                }
                aria-describedby={noteId}
              >
                <Icon
                  className={cn(
                    "mt-0.5 size-4.5 shrink-0",
                    available
                      ? "text-muted-foreground"
                      : "text-muted-foreground/60"
                  )}
                />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span
                    className={cn(
                      "flex items-center gap-2",
                      !available && "text-muted-foreground"
                    )}
                  >
                    {option.label}
                    {option.id !== "free" ? (
                      <span
                        data-slot="coach-pro-badge"
                        className="rounded border border-border px-1.5 text-xs font-medium text-muted-foreground"
                      >
                        Pro
                      </span>
                    ) : null}
                  </span>
                  <span
                    id={noteId}
                    data-slot="coach-mode-note"
                    className="text-xs leading-4 whitespace-normal text-muted-foreground"
                  >
                    {available ? option.helper : COACH_MODE_LOCKED}
                  </span>
                </span>
              </DropdownMenuRadioItem>
            )
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null

  const actions = (
    <>
      {modePicker}
      {turnActive ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={(event) => {
            if (!repeatedClickOfSend(event)) onStop?.()
          }}
          aria-label="Stop"
          className="-m-1.5 size-11 rounded-full border-0 hover:bg-transparent md:m-0 md:size-8"
        >
          <span className={cn(signatureIconButton, SEND_FACE)}>
            <Square className="size-3 fill-current" />
          </span>
        </Button>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onSend}
          disabled={!canSend}
          aria-label="Send"
          aria-describedby={held ? sendHoldId : undefined}
          className="-m-1.5 size-11 rounded-full border-0 hover:bg-transparent md:m-0 md:size-8"
        >
          <span
            data-slot="coach-send-face"
            className={cn(
              canSend
                ? signatureIconButton
                : "bg-secondary text-secondary-foreground",
              SEND_FACE
            )}
          >
            <ArrowUp className="size-4" />
          </span>
        </Button>
      )}
    </>
  )

  const field = (
    <PromptInput
      data-slot="coach-composer"
      data-pen-surface="coach"
      data-capped={disabled && Boolean(notice) ? "" : undefined}
      className={cn(
        notice &&
          "rounded-t-none border-0 shadow-none [&_[data-slot=input-group-addon]]:pb-2 [&_textarea]:min-h-10 [&_textarea]:py-2"
      )}
      value={draft}
      onValueChange={setDraft}
      onSubmit={onSend}
      submitBlocked={turnActive || disabled || held}
      disabled={disabled}
      placeholder={placeholder}
      label="Message Coach"
      tools={tools}
      actions={actions}
    />
  )
  const composer = (
    <div className="flex flex-col gap-1.5">
      {held ? (
        <p
          id={sendHoldId}
          data-slot="coach-send-hold"
          className={cn(
            "px-3 text-xs leading-4 text-muted-foreground",
            !showHold && "invisible"
          )}
        >
          {holdReason}
        </p>
      ) : null}
      {field}
    </div>
  )
  return notice ? (
    <div
      data-slot="coach-composer-card"
      className="overflow-hidden rounded-lg border border-border/60 bg-card"
    >
      <div className="border-b border-border/60 bg-muted/40 px-4 py-3">
        {notice}
      </div>
      {composer}
    </div>
  ) : (
    composer
  )
}
