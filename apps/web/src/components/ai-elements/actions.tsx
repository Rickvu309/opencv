import { useEffect, useReducer } from "react"
import { Check, Copy, RefreshCw } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { copyText } from "@workspace/ui/components/copy-button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"

const hit =
  "size-4 box-content p-2.5 -m-2.5 text-muted-foreground hover:text-foreground min-h-9 min-w-9 [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11 motion-reduce:animate-none motion-reduce:transition-none"

type CopyState = { copied: boolean; notice: string }
type CopyAction =
  { type: "copied" } | { type: "settled" } | { type: "regenerating" }

function noticeOf(current: string, next: string) {
  return current === next ? `${next}\u00a0` : next
}

function copyReducer(state: CopyState, action: CopyAction): CopyState {
  switch (action.type) {
    case "copied":
      return { copied: true, notice: noticeOf(state.notice, "Copied") }
    case "settled":
      return { ...state, copied: false }
    case "regenerating":
      return {
        ...state,
        notice: noticeOf(state.notice, "Regenerating"),
      }
  }
}

export function MessageActions({
  text,
  onRegenerate,
  canRegenerate = true,
  label = "Reply actions",
}: {
  text: string
  onRegenerate?: () => void
  canRegenerate?: boolean
  label?: string
}) {
  const [{ copied, notice }, dispatch] = useReducer(copyReducer, {
    copied: false,
    notice: "",
  })
  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => dispatch({ type: "settled" }), 1600)
    return () => window.clearTimeout(timer)
  }, [copied])

  return (
    <div
      role="group"
      aria-label={label}
      data-slot="message-actions"
      className="flex items-center gap-4"
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={copied ? "Copied" : "Copy"}
              className={hit}
              onClick={() => {
                void copyText(text)
                dispatch({ type: "copied" })
              }}
            >
              {copied ? <Check /> : <Copy />}
            </Button>
          }
        />
        <TooltipContent>{copied ? "Copied" : "Copy"}</TooltipContent>
      </Tooltip>
      {onRegenerate ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Regenerate"
                className={hit}
                disabled={!canRegenerate}
                onClick={() => {
                  onRegenerate()
                  dispatch({ type: "regenerating" })
                }}
              >
                <RefreshCw />
              </Button>
            }
          />
          <TooltipContent>Regenerate</TooltipContent>
        </Tooltip>
      ) : null}
      <span className="sr-only" aria-live="polite">
        {notice}
      </span>
    </div>
  )
}
