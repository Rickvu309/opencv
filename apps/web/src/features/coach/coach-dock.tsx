import "./design/coach.pen.css"
import "./design/composer-menus.pen.css"

import { useReducer, type ReactNode } from "react"
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
import { SURFACE_PATHS } from "@/lib/product-paths.ts"
import { COACH_MODE_OPTIONS } from "@/features/coach/coach-mode.ts"
import { useCoachMode } from "@/features/coach/use-coach-mode.ts"

const DOCK_MENU = [
  { id: "upload", label: "Upload a file", icon: Paperclip, caret: false },
  { id: "attach", label: "Add from Paper", icon: FileText, caret: true },
  { id: "job", label: "Add a job from Apply", icon: Kanban, caret: true },
  { id: "link", label: "Paste a job link", icon: Link, caret: false },
] as const

type MenuId = Exclude<(typeof DOCK_MENU)[number]["id"], "upload">

/** Coach reads a file by name and size only, and no upload route accepts one for Coach. */
export const UPLOAD_UNAVAILABLE = "Coach cannot read uploaded files yet."

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
  /** Recent Paper documents for the Add menu. Without it the menu has no Recent section. */
  recent?: DockRecentList
  onRecentSelect?: (id: string) => void
  onAddMenuOpenChange?: (open: boolean) => void
  disabled?: boolean
  /** A limit or off notice shown as the top band of the one composer card. */
  notice?: ReactNode
  /** Marks the Add control as the screen's one primary action. Only the Coach page sets it. */
  primaryAction?: boolean
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
  disabled = false,
  notice,
  primaryAction = false,
}: Props) {
  const navigate = useNavigate()
  const [menuOpen, menuDispatch] = useReducer(menuReducer, false)
  const [modeMenuOpen, modeMenuDispatch] = useReducer(menuReducer, false)
  const { mode, setMode, plan } = useCoachMode()
  const canSend = draft.trim().length > 0 && !disabled

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
            className="rounded-full border border-border text-muted-foreground"
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
            const unavailable = item.id === "upload"
            return (
              <DropdownMenuItem
                key={item.id}
                data-add-row=""
                disabled={unavailable}
                onClick={
                  item.id === "upload"
                    ? undefined
                    : () => handleMenuAction(item.id)
                }
              >
                <Icon />
                <span data-add-label="">{item.label}</span>
                {unavailable ? (
                  <span className="sr-only">{UPLOAD_UNAVAILABLE}</span>
                ) : null}
                {item.caret ? <ChevronRight data-add-caret="" /> : null}
              </DropdownMenuItem>
            )
          }
        )}
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
            className="h-7.5 gap-1.25 rounded-full px-2 text-muted-foreground disabled:font-semibold disabled:text-muted-foreground/70"
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
            if (next !== "free" && plan !== "pro") {
              void navigate({ href: "/settings/billing/upgrade" })
              return
            }
            setMode(next)
          }}
        >
          {COACH_MODE_OPTIONS.map((option) => {
            const Icon = MODE_ICONS[option.id]
            return (
              <DropdownMenuRadioItem
                key={option.id}
                value={option.id}
                closeOnClick
                className="h-10 gap-3.5 rounded-lg px-3 data-checked:pe-8"
                aria-label={
                  option.id === "free" ? option.label : `${option.label} · Pro`
                }
              >
                <Icon className="size-4.5 shrink-0 text-muted-foreground" />
                <span className="flex min-w-0 flex-1">{option.label}</span>
                {option.id !== "free" ? (
                  <span
                    data-slot="coach-pro-badge"
                    className="ms-auto rounded border border-border px-1.5 text-xs font-medium text-muted-foreground"
                  >
                    Pro
                  </span>
                ) : null}
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
          variant="secondary"
          size="icon"
          onClick={onStop}
          aria-label="Stop"
          className="rounded-full"
        >
          <Square className="size-3 fill-current" />
        </Button>
      ) : (
        <Button
          type="button"
          variant={canSend ? "default" : "secondary"}
          size="icon"
          onClick={onSend}
          disabled={!canSend}
          aria-label="Send"
          className="rounded-full"
        >
          <ArrowUp className="size-4" />
        </Button>
      )}
    </>
  )

  const composer = (
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
      submitBlocked={turnActive || disabled}
      disabled={disabled}
      placeholder={placeholder}
      label="Message Coach"
      tools={tools}
      actions={actions}
    />
  )
  return notice ? (
    <div
      data-slot="coach-composer-card"
      className="overflow-hidden rounded-2xl border border-border/60 bg-card"
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
