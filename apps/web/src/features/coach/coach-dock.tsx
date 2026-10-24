import { useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import {
  ArrowUp,
  Clock,
  Mic,
  Paperclip,
  Plug,
  Plus,
  Square,
  Upload,
  X,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"

import { PromptInput } from "@/components/ai-elements/prompt-input.tsx"
import { ComingSoon } from "@/components/coming-soon.tsx"
import { SURFACE_PATHS } from "@/features/app-shell/surfaces.ts"
import { COACH_MODE_OPTIONS } from "@/features/home/coach-mode.ts"
import { useCoachMode } from "@/features/home/use-coach-mode.ts"

const DOCK_MENU = [
  { id: "upload", label: "Upload a file", icon: Upload, comingSoon: true },
  { id: "recent", label: "Recent", icon: Clock, comingSoon: true },
  { id: "attach", label: "Attach from Paper", icon: Paperclip },
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
  /** Paper CoachFloat: attach the open doc. Home still routes to Paper. */
  onAttachFromPaper?: () => void
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
}: Props) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const { mode, setMode } = useCoachMode()
  const canSend = draft.trim().length > 0

  function handleMenuAction(id: MenuId) {
    setMenuOpen(false)
    if (id === "connector") {
      void navigate({ to: SURFACE_PATHS.settings, search: { tab: "apps" } })
    }
    if (id === "attach") {
      if (onAttachFromPaper) {
        onAttachFromPaper()
        return
      }
      void navigate({ to: SURFACE_PATHS.paper })
    }
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
        >
          {menuOpen ? <X /> : <Plus />}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side={menuPlacement === "above" ? "top" : "bottom"}
          align="start"
          sideOffset={8}
          className="w-56 min-w-56"
        >
          {DOCK_MENU.map((item) => {
            const Icon = item.icon
            const comingSoon = "comingSoon" in item && item.comingSoon
            return (
              <DropdownMenuItem
                key={item.id}
                disabled={comingSoon}
                onClick={
                  comingSoon ? undefined : () => handleMenuAction(item.id)
                }
              >
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                {item.label}
                {comingSoon ? <ComingSoon /> : null}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      {showModePicker ? (
        <SegmentedControl
          aria-label="Coach mode"
          kind="radio"
          variant="tray"
          size="md"
          options={MODE_SEGMENTS}
          value={mode}
          onChange={setMode}
        />
      ) : null}
    </>
  )

  const actions = (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <span className="inline-flex">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled
                  aria-disabled="true"
                  aria-label="Voice input — coming soon"
                  className="rounded-full text-muted-foreground"
                >
                  <Mic className="size-4" />
                  <ComingSoon silent />
                </Button>
              </span>
            }
          />
          <TooltipContent>Coming soon</TooltipContent>
        </Tooltip>
      </TooltipProvider>
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
      submitBlocked={turnActive}
      placeholder={placeholder}
      label="Message Coach"
      tools={tools}
      actions={actions}
    />
  )
}
