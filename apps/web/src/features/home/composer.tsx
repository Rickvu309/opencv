import { useEffect, useRef, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import {
  ArrowUp,
  Clock,
  Mic,
  Paperclip,
  Plug,
  Plus,
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
import { cn } from "@workspace/ui/lib/utils"

import { SURFACE_PATHS } from "@/features/app-shell/surfaces.ts"

const LINE_HEIGHT_PX = 24
const MAX_LINES = 8

const DOCK_MENU = [
  { id: "upload", label: "Upload a file", icon: Upload },
  { id: "recent", label: "Recent", icon: Clock },
  { id: "attach", label: "Attach from Paper", icon: Paperclip },
  { id: "connector", label: "Add connector", icon: Plug },
] as const

type MenuId = (typeof DOCK_MENU)[number]["id"]

type Props = {
  draft: string
  setDraft: (value: string) => void
  onSend: () => void
  placeholder?: string
  menuPlacement?: "below" | "above"
}

export function Composer({
  draft,
  setDraft,
  onSend,
  placeholder = "How can I help you today?",
  menuPlacement = "below",
}: Props) {
  const navigate = useNavigate()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const canSend = draft.trim().length > 0

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    const maxHeight = LINE_HEIGHT_PX * MAX_LINES
    const next = Math.min(el.scrollHeight, maxHeight)
    el.style.height = `${next}px`
    const hasMultipleLines = draft.includes("\n") || next > LINE_HEIGHT_PX + 2
    setExpanded(hasMultipleLines)
  }, [draft])

  function handleMenuAction(id: MenuId) {
    setMenuOpen(false)
    if (id === "connector") {
      void navigate({ to: SURFACE_PATHS.settings, search: { tab: "apps" } })
    }
    if (id === "attach") {
      void navigate({ to: SURFACE_PATHS.paper })
    }
  }

  const addButton = (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger
        aria-label={menuOpen ? "Close menu" : "Add"}
        className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
      >
        {menuOpen ? <X className="size-4" /> : <Plus className="size-4" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={menuPlacement === "above" ? "top" : "bottom"}
        align="start"
        sideOffset={8}
        className="w-56 min-w-56"
      >
        {DOCK_MENU.map((item) => {
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
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const micButton = (
    <button
      type="button"
      aria-label="Voice input"
      className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
    >
      <Mic className="size-4" />
    </button>
  )

  const sendButton = (
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
  )

  const textarea = (
    <textarea
      ref={textareaRef}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault()
          onSend()
        }
      }}
      placeholder={placeholder}
      rows={1}
      className={cn(
        "min-w-0 resize-none overflow-y-auto bg-transparent text-[15px] leading-6 outline-none placeholder:text-muted-foreground",
        expanded ? "max-h-48 w-full px-0.5" : "max-h-6 min-h-6 flex-1 py-0"
      )}
      aria-label="Message"
    />
  )

  const trailingActions = (
    <div className="flex shrink-0 items-center gap-0.5">
      {micButton}
      {sendButton}
    </div>
  )

  return (
    <div className="relative w-full">
      <div
        className={cn(
          "border border-border/80 bg-background shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-[border-radius,padding] duration-200 ease-out focus-within:border-border focus-within:shadow-[0_2px_8px_rgba(0,0,0,0.06)]",
          expanded
            ? "flex flex-col rounded-[1.25rem] px-4 pt-3.5 pb-2.5"
            : "flex min-h-[3.25rem] items-center gap-1 rounded-full px-2.5 py-2"
        )}
      >
        {expanded ? null : addButton}
        {textarea}
        {expanded ? (
          <div className="mt-1 flex w-full items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1">{addButton}</div>
            {trailingActions}
          </div>
        ) : (
          trailingActions
        )}
      </div>
    </div>
  )
}
