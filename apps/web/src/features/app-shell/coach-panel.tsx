import {
  Children,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { useNavigate } from "@tanstack/react-router"
import { Maximize2, Minus, X } from "lucide-react"

import { shellCopy } from "@/features/app-shell/shell-copy.ts"
import { setCoachPanelCovering } from "@/features/coach/coach-panel-presence.ts"
import { CoachThread } from "@/features/coach/coach-thread.tsx"
import {
  DESKTOP_MEDIA_QUERY,
  useMediaQuery,
} from "@/features/app-shell/use-media-query.ts"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

export type CoachPanelMode = "dock" | "side" | "full"

type CoachPanelProps = {
  title: string
  open: boolean
  mode: CoachPanelMode
  onMinimize: () => void
  onExpand: () => void
  onClose: () => void
  children?: ReactNode
}

function childChatId(children: ReactNode) {
  for (const child of Children.toArray(children)) {
    if (!isValidElement(child)) continue
    const props = child.props as { chatId?: string | null }
    if ("chatId" in props) return props.chatId ?? null
  }
  return null
}

export function CoachPanel({
  title,
  open,
  mode,
  onMinimize,
  onExpand,
  onClose,
  children,
}: CoachPanelProps) {
  const navigate = useNavigate()
  const desktop = useMediaQuery(DESKTOP_MEDIA_QUERY, true)
  const sectionRef = useRef<HTMLElement>(null)
  const fromChild = childChatId(children)
  const [chatId, setChatId] = useState<string | null>(fromChild)
  const [seenChild, setSeenChild] = useState(fromChild)
  if (fromChild !== seenChild) {
    setSeenChild(fromChild)
    setChatId(fromChild)
  }

  useEffect(() => {
    const node = sectionRef.current
    if (!open || !node) {
      setCoachPanelCovering(false)
      return
    }
    const sync = () => {
      setCoachPanelCovering(node.closest("[hidden]") == null)
    }
    sync()
    const observer = new MutationObserver(sync)
    let parent: Node | null = node
    while (parent) {
      if (parent instanceof Element) {
        observer.observe(parent, {
          attributes: true,
          attributeFilter: ["hidden"],
        })
      }
      parent = parent.parentNode
    }
    return () => {
      observer.disconnect()
      setCoachPanelCovering(false)
    }
  }, [open])

  if (!open) return null

  return (
    <section
      ref={sectionRef}
      data-slot="coach-panel"
      aria-label={title}
      className={cn(
        "flex h-full min-h-0 flex-col bg-background duration-(--duration-panel) ease-(--ease-panel)",
        desktop ? "" : "fixed inset-0 z-40"
      )}
    >
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3">
        <div className="min-w-0 flex-1 truncate text-sm font-medium">
          {title}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={shellCopy.minimize}
          onClick={onMinimize}
        >
          <Minus />
        </Button>
        {desktop ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={shellCopy.expand}
            aria-pressed={mode === "full"}
            onClick={() => {
              onExpand()
              void navigate({
                href: chatId ? `/app/coach/${chatId}` : "/app/coach",
              })
            }}
          >
            <Maximize2 />
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={shellCopy.close}
          onClick={onClose}
        >
          <X />
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        <CoachThread chatId={chatId} variant="panel" onChatId={setChatId} />
      </div>
    </section>
  )
}
