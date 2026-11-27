import { useReducer } from "react"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

import type { PageSetup } from "@workspace/domain/paper-doc"

import { MPT_PER_CM } from "./format-commands.ts"

const SIDES = ["top", "right", "bottom", "left"] as const
type Side = (typeof SIDES)[number]
const SIZES = ["A4", "Letter"] as const

const toCm = (mpt: number) => String(Math.round((mpt / MPT_PER_CM) * 100) / 100)

function marginsInCm(page: PageSetup): Record<Side, string> {
  return {
    top: toCm(page.marginsMpt.top),
    right: toCm(page.marginsMpt.right),
    bottom: toCm(page.marginsMpt.bottom),
    left: toCm(page.marginsMpt.left),
  }
}

type Draft = {
  shown: boolean
  size: PageSetup["size"]
  margins: Record<Side, string>
}

type DraftAction =
  | { type: "shown"; open: boolean; page: PageSetup }
  | { type: "size"; size: PageSetup["size"] }
  | { type: "margin"; side: Side; value: string }

function draftOf(page: PageSetup, shown = false): Draft {
  return { shown, size: page.size, margins: marginsInCm(page) }
}

function draftReducer(draft: Draft, action: DraftAction): Draft {
  if (action.type === "shown")
    return action.open ? draftOf(action.page, true) : { ...draft, shown: false }
  if (action.type === "size") return { ...draft, size: action.size }
  return {
    ...draft,
    margins: { ...draft.margins, [action.side]: action.value },
  }
}

export function PageSetupDialog({
  open,
  page,
  onOpenChange,
  onApply,
}: {
  open: boolean
  page: PageSetup
  onOpenChange: (open: boolean) => void
  onApply: (page: PageSetup) => void
}) {
  const [draft, dispatch] = useReducer(draftReducer, page, (initial) =>
    draftOf(initial, open)
  )
  if (open !== draft.shown) dispatch({ type: "shown", open, page })
  const { size, margins } = draft
  const parsed = SIDES.map((side) => Number(margins[side]))
  const valid = parsed.every((cm) => Number.isFinite(cm) && cm >= 0 && cm <= 10)
  const apply = () => {
    if (!valid) return
    const [top, right, bottom, left] = parsed.map((cm) =>
      Math.round(cm * MPT_PER_CM)
    ) as [number, number, number, number]
    onApply({ ...page, size, marginsMpt: { top, right, bottom, left } })
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Page setup</DialogTitle>
          <DialogDescription>
            Paper size and margins for Word and PDF.
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            apply()
          }}
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <span className="text-ui font-medium">Paper size</span>
              <div className="flex gap-2" role="group" aria-label="Paper size">
                {SIZES.map((each) => (
                  <Button
                    key={each}
                    type="button"
                    size="touch"
                    variant={size === each ? "secondary" : "outline"}
                    aria-pressed={size === each}
                    onClick={() => dispatch({ type: "size", size: each })}
                  >
                    {each === "A4" ? "A4 (default)" : "Letter"}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {SIDES.map((side) => (
                <div key={side} className="flex flex-col gap-1.5">
                  <Label htmlFor={`paper-margin-${side}`}>
                    {`${side[0]!.toUpperCase()}${side.slice(1)} margin (cm)`}
                  </Label>
                  <Input
                    id={`paper-margin-${side}`}
                    inputMode="decimal"
                    value={margins[side]}
                    aria-invalid={
                      !Number.isFinite(Number(margins[side])) || undefined
                    }
                    onChange={(event) =>
                      dispatch({
                        type: "margin",
                        side,
                        value: event.target.value,
                      })
                    }
                  />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              size="touch"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="touch" disabled={!valid}>
              Apply
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
