import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import {
  ArrowUp,
  Paperclip,
  Plug,
  Plus,
  Square,
  X,
  Briefcase,
  Link,
} from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { InputGroupButton } from "@workspace/ui/components/input-group"
import { SegmentedControl } from "@workspace/ui/components/segmented-control"

import { fetchUsage, usageKey } from "@/lib/account-api.ts"
import { PromptInput } from "@/components/ai-elements/prompt-input.tsx"
import { SURFACE_PATHS } from "@/lib/product-paths.ts"
import { COACH_MODE_OPTIONS } from "@/features/coach/coach-mode.ts"
import { useCoachMode } from "@/features/coach/use-coach-mode.ts"
import { settingsSectionHref } from "@/features/settings/sections.ts"

const DOCK_MENU = [
  { id: "attach", label: "Attach from Paper", icon: Paperclip },
  { id: "job", label: "Attach from Apply", icon: Briefcase },
  { id: "link", label: "Paste a link", icon: Link },
  { id: "connector", label: "Add connector", icon: Plug },
] as const

type MenuId = (typeof DOCK_MENU)[number]["id"]

const MODE_SEGMENTS = COACH_MODE_OPTIONS.map(({ id, label }) => ({
  value: id,
  label,
}))

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
  disabled?: boolean
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
  disabled = false,
  primaryAction = false,
}: Props) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const { mode, setMode, plan } = useCoachMode()
  const usage = useQuery({ queryKey: usageKey(), queryFn: fetchUsage })
  const canSend = draft.trim().length > 0 && !disabled

  function handleMenuAction(id: MenuId) {
    setMenuOpen(false)
    if (id === "job") {
      if (onAttachJob) onAttachJob()
      else void navigate({ to: SURFACE_PATHS.apply })
    }
    if (id === "link") onAttachLink?.()
    if (id === "connector") {
      void navigate({ href: settingsSectionHref("integrations") })
    }
    if (id === "attach") onAttachFromPaper()
  }

  const tools = (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger
          render={
            <InputGroupButton
              size="icon-sm"
              className="rounded-full text-muted-foreground"
            />
          }
          aria-label={menuOpen ? "Close menu" : "Add"}
          data-primary-action={primaryAction ? "" : undefined}
        >
          {menuOpen ? <X /> : <Plus />}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side={menuPlacement === "above" ? "top" : "bottom"}
          align="start"
          sideOffset={8}
          className="w-56 min-w-56"
        >
          {DOCK_MENU.filter((item) => item.id !== "link" || onAttachLink).map(
            (item) => {
              const Icon = item.icon
              return (
                <DropdownMenuItem
                  key={item.id}
                  onClick={() => handleMenuAction(item.id)}
                >
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  {item.label}
                </DropdownMenuItem>
              )
            }
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {showModePicker ? (
        <SegmentedControl
          aria-label="Coach mode"
          kind="radio"
          variant="tray"
          size="md"
          options={MODE_SEGMENTS.map((option) => ({
            ...option,
            ariaLabel: option.label,
            count:
              usage.data?.mode === option.value && usage.data.day.capped
                ? usage.data.day.remaining
                : undefined,
          }))}
          value={mode}
          onChange={(next) => {
            if (next !== "free" && plan !== "pro") {
              void navigate({ href: "/settings/billing/upgrade" })
              return
            }
            setMode(next)
          }}
        />
      ) : null}
    </>
  )

  const actions = (
    <>
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

  return (
    <PromptInput
      data-slot="coach-composer"
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
}
