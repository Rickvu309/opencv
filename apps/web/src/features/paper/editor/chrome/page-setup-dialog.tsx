import { useState } from "react"

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
  const [size, setSize] = useState(page.size)
  const [margins, setMargins] = useState(() => marginsInCm(page))
  const [shown, setShown] = useState(open)
  if (open !== shown) {
    setShown(open)
    if (open) {
      setSize(page.size)
      setMargins(marginsInCm(page))
    }
  }
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
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-ui font-medium">Paper size</span>
            <div className="flex gap-2" role="group" aria-label="Paper size">
              {SIZES.map((each) => (
                <Button
                  key={each}
                  variant={size === each ? "secondary" : "outline"}
                  aria-pressed={size === each}
                  onClick={() => setSize(each)}
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
                    setMargins({ ...margins, [side]: event.target.value })
                  }
                />
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!valid} onClick={apply}>
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
